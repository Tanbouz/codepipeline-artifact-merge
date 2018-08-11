const AWS = require('aws-sdk');
const JSZip = require("jszip");
const TarToZip = require("./tarToZip.js");
const fs = require('fs');

const s3 = new AWS.S3();
const codepipeline = new AWS.CodePipeline();

var jobId = undefined;
var context = undefined;
var detectedServerSideEncryption = "";

// Notify AWS CodePipeline of a successful job
const putJobSuccess = function (message) {
    let params = {
        jobId: jobId
    };
    codepipeline.putJobSuccessResult(params, function (err, data) {
        if (err) {
            context.fail(err);
        } else {
            context.succeed(message);
        }
    });
};

// Notify AWS CodePipeline of a failed job
const putJobFailure = function (message) {
    let params = {
        jobId: jobId,
        failureDetails: {
            message: JSON.stringify(message),
            type: 'JobFailed',
            externalExecutionId: context.invokeid
        }
    };
    codepipeline.putJobFailureResult(params, function (err, data) {
        context.fail(message);
    });
};

// Retrieve an artifact from S3
const getArtifact = async function (bucket, key, name, revision) {
    let data = null;

    try {
        if(TarToZip.isTar(key)) {
            let metadata = await s3.headObject({ Bucket: bucket, Key: key }).promise();
            let s3Stream = s3.getObject({ Bucket: bucket, Key: key }).createReadStream();
            data = await getTarArtifact(s3Stream, name);
            data.ServerSideEncryption = metadata.ServerSideEncryption;
        }
        else {
            data = await s3.getObject({ Bucket: bucket, Key: key }).promise();
        }
        
        console.log(`${bucket}/${key} fetched. ${data.ContentLength} bytes`);
        detectedServerSideEncryption = data.ServerSideEncryption;
        return { 'data': data.Body, 'name': name, 'revision': revision };
    }
    catch(error) {
        console.log(`Failed to retrieve from S3: ${bucket}/${key}`);
        throw error;
    }
};

const getTarArtifact = async function (s3Stream, name) {
    try {   
        let filename = await TarToZip.convert(s3Stream, name);

        let content = fs.readFileSync(filename);
        console.log(`convert ${filename} successed. ${content.length} bytes`);

        return {
            ContentLength: content.length,
            //ServerSideEncryption: "",
            Body: content
        }
    }
    catch(error) {
        console.log("Failed to retrieve from S3: " + bucket + key);
        throw error;
    }
}

// Put an artifact on S3
const putArtifact = async function (bucket, key, artifact) {
    try{
        let params = {
            Body: artifact,
            Bucket: bucket,
            ContentType: "application/zip",
            Key: key
        };
        if (detectedServerSideEncryption) {
            params.ServerSideEncryption = detectedServerSideEncryption;
        }
        let result = await s3.putObject(params).promise();
        return result;
    }
    catch(error) {
        throw error;
    }
};

// Merges zip files synchronously in a recursive manner (Await/Async when Lambda supports Node8?)
const mergeArtifacts = function (output_artifact, input_artifacts, index, options) {
    return new Promise((resolve, reject) => {
        if (options && options.subfolder === true) {
            // Merge into subfolders
            let folder_name = input_artifacts[index].name
            var merge_target = output_artifact.folder(folder_name);
            if (options.revisions === true) {
                // create a text file with revision id
                merge_target.file(".revision-id", input_artifacts[index].revision);
            }
        } else {
            // Merge at root level
            var merge_target = output_artifact;
            if (options && options.revisions === true) {
                merge_target.file(".revision-id-" + input_artifacts[index].name, input_artifacts[index].revision);
            }
        }

        // Load the current zip artifact into our output zip
        merge_target.loadAsync(input_artifacts[index].data).then(() => {
            index += 1;
            if (index < input_artifacts.length) {
                // Process next zip artifact
                mergeArtifacts(output_artifact, input_artifacts, index, options).then(next_merged_artifact => {
                    resolve(next_merged_artifact);
                });
            } else {
                // Last recursive call should drop here
                resolve(output_artifact);
            }
            // JSZip: "The promise can fail if the loaded data is not valid zip data or if it uses unsupported features (multi volume, password protected, etc)."
        }).catch((error) => {
            reject(error);
        });
    });
};

// Merge all artifacts
const mergeAll = function (output_artifact, input_artifacts, options) {
    let new_zip = new JSZip();

    // Merge zipped input artifacts into a single zipped output artifact
    mergeArtifacts(new_zip, input_artifacts, 0, options).then(merged_zip => {
        // Encode the merged output artifact then upload to S3    
        merged_zip.generateAsync({ type: "nodebuffer", platform: process.platform }).then(output_artifact_body => {
            putArtifact(output_artifact.bucketName, output_artifact.objectKey, output_artifact_body).then(() => {
                console.log("Merged artifacts successfully and uploaded to S3.");
                putJobSuccess("Merged artifacts successfully.");
            }).catch((error) => {
                console.log("S3 put error: " + error);
                putJobFailure("Failed to upload output artifact to S3.");
            });
        });
    }).catch((error) => {
        console.log("JSZip error: " + error);
        putJobFailure("Failed to load zipped artifact.");
    });
}

// parameters_string should be a json string, i.e. '{ "subfolder": true }';
const parseParametersString = function (parameters_string) {
    if (parameters_string) {
        return JSON.parse(parameters_string);
    } else {
        return null;
    }
}

exports.handler = function (event, _context) {
    // Retrieve the Job ID from the Lambda action
    jobId = event["CodePipeline.job"].id;
    context = _context;

    // Parameters to customize function
    let parameters_string = event["CodePipeline.job"].data.actionConfiguration.configuration.UserParameters;
    let options = null;

    try {
        options = parseParametersString(parameters_string);
    } catch (error) {
        console.log(error);
        putJobFailure("Invalid JSON input error");
        return;
    }

    // CodePipeline event meta data
    let job_meta = event['CodePipeline.job']['data'];
    let input_artifacts_meta = job_meta['inputArtifacts'];
    let output_artifacts_meta = job_meta['outputArtifacts'];

    // Artifact - S3 download promises
    let await_input_artifacts = [];

    if (output_artifacts_meta.length > 0) {
        try {
            let output_artifact = output_artifacts_meta[0].location.s3Location;
            // Download all input artifacts from S3
            for (let artifact of input_artifacts_meta) {
                await_input_artifacts.push(getArtifact(artifact.location.s3Location.bucketName, artifact.location.s3Location.objectKey, artifact.name, artifact.revision));
            }
            // Wait till all input artifacts are fetched.
            Promise.all(await_input_artifacts).then(input_artifacts => {
                console.log(input_artifacts.length + " artifacts fetched.");
                if (input_artifacts.length > 0) {
                    mergeAll(output_artifact, input_artifacts, options);
                } else {
                    console.log("No artifacts found. Nothing to merge.");
                    putJobSuccess("No artifacts found. Nothing to merge.");
                }
            }).catch((error) => {
                console.log("S3 get error: " + error);
                putJobFailure("Failed to retrieve an object from S3.");
            });
        } catch (error) {
            console.log(error);
            putJobFailure("Unknown error: check CloudWatch logs.");
        }
    } else {
        putJobFailure("No output artifact configured.");
    }
};

exports.mergeArtifacts = mergeArtifacts;

exports.parseParametersString = parseParametersString;

exports.getTarArtifact = getTarArtifact;