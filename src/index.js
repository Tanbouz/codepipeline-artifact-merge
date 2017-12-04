const AWS = require('aws-sdk');
const JSZip = require("jszip");
const s3 = new AWS.S3();
const codepipeline = new AWS.CodePipeline();

var jobId = undefined;
var event_context = undefined;

// Notify AWS CodePipeline of a successful job
const putJobSuccess = function (message) {
    let params = {
        jobId: jobId
    };
    codepipeline.putJobSuccessResult(params, function (err, data) {
        if (err) {
            event_context.fail(err);
        } else {
            event_context.succeed(message);
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
            externalExecutionId: event_context.invokeid
        }
    };
    codepipeline.putJobFailureResult(params, function (err, data) {
        event_context.fail(message);
    });
};

// Retrieves artifacts from S3
const getArtifacts = function (bucket, key) {
    return new Promise((resolve, reject) => {
        s3.getObject({ Bucket: bucket, Key: key }, function (error, data) {
            if (error != null) {
                console.log("getArtifacts(): Failed to retrieve an object: " + error);
                putJobFailure("getArtifacts(): Failed to retrieve an object: " + error);
                reject(error);
            } else {
                console.log("Loaded " + data.ContentLength + " bytes");
                resolve(data.Body);
            }
        });
    });
};

// Merges zip files synchronously in a recursive manner
const mergeArtifacts = function (output_artifact, input_artifacts_array, index) {
    return new Promise((resolve, reject) => {
        // Load the current zip artifact into our output zip
        output_artifact.loadAsync(input_artifacts_array[index]).then(updated_output_artifact => {
            index += 1;
            if (index < input_artifacts_array.length) {
                // Process next zip artifact
                mergeArtifacts(updated_output_artifact, input_artifacts_array, index).then(next_output_artifact => {
                    resolve(next_output_artifact);
                });
            } else {
                // Last recursive call should drop here
                resolve(updated_output_artifact);
            }
        });
    });
};

exports.handler = function (event, context) {
    try {
        // Retrieve the Job ID from the Lambda action & store context globally
        event_context = context;
        jobId = event["CodePipeline.job"].id;

        // [Optional] parameters to customize function if needed later on, not currently used.
        let url = event["CodePipeline.job"].data.actionConfiguration.configuration.UserParameters;

        // CodePipeline event meta data
        job = event['CodePipeline.job']['data'];
        input_artifacts = job['inputArtifacts'];
        output_artifacts = job['outputArtifacts'];

        // Array to hold S3 download promises
        let await_input_artifacts = [];

        // Download all input artifacts from S3
        for (let artifact of input_artifacts) {
            console.log("Getting an artifact...");
            await_input_artifacts.push(getArtifacts(artifact.location.s3Location.bucketName, artifact.location.s3Location.objectKey));
        }

        // Wait till downloading of input artifacts is complete.
        Promise.all(await_input_artifacts).then(input_artifacts_array => {
            var new_zip = new JSZip();

            // Merge zipped input artifacts into a single zipped output artifact
            mergeArtifacts(new_zip, input_artifacts_array, 0).then(merged_zip => {
                // Encode the merged and zipped output artifact then upload to S3
                console.log("Uploading zipped output artifact to S3...");
                merged_zip.generateAsync({ type: "nodebuffer" }).then(merged_zip_encoded => {
                    let output_artifact = output_artifacts[0].location.s3Location;

                    let params = {
                        Body: merged_zip_encoded,
                        Bucket: output_artifact.bucketName,
                        ContentType: "application/zip",
                        Key: output_artifact.objectKey,
                        ServerSideEncryption: "AES256"
                    };

                    s3.putObject(params, function (err, data) {
                        if (err) {
                            putJobFailure("S3 failure");
                            console.log(err, err.stack);
                        } else {
                            putJobSuccess("Tests passed.");
                            console.log("Done");
                        }
                    });
                });
            });
        });
    } catch (error) {
        putJobFailure("General failure: " + error);
        console.log(error);
    }
};
