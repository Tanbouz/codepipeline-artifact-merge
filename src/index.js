const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const codepipeline = new AWS.CodePipeline();
const JSZip = require("jszip");

exports.handler = function (event, context) {
    // Retrieve the Job ID from the Lambda action
    var jobId = event["CodePipeline.job"].id;

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
    const getArtifact = function (bucket, key) {
        return new Promise((resolve, reject) => {
            s3.getObject({ Bucket: bucket, Key: key }, function (error, data) {
                if (error != null) {
                    console.log("Failed to retrieve from S3: "+ bucket + key);
                    reject(error);
                } else {
                    console.log(bucket + key + " fetched. " + data.ContentLength + " bytes");
                    resolve(data.Body);
                }
            });
        });
    };

    // Merges zip files synchronously in a recursive manner
    const mergeArtifacts = function (output_artifact, input_artifacts, index) {
        return new Promise((resolve, reject) => {
            // Load the current zip artifact into our output zip
            output_artifact.loadAsync(input_artifacts[index]).then(updated_output_artifact => {
                index += 1;
                if (index < input_artifacts.length) {
                    // Process next zip artifact
                    mergeArtifacts(updated_output_artifact, input_artifacts, index).then(next_output_artifact => {
                        resolve(next_output_artifact);
                    });
                } else {
                    // Last recursive call should drop here
                    resolve(updated_output_artifact);
                }
                // JSZip: "The promise can fail if the loaded data is not valid zip data or if it uses unsupported features (multi volume, password protected, etc)."
            }).catch((error) => {
                console.log("JSZip loadAsync failure: " + error);
                putJobFailure("Failed to load ZIP");
            });
        });
    };

    // [Optional] parameters to customize function if needed later on, not currently used.
    let url = event["CodePipeline.job"].data.actionConfiguration.configuration.UserParameters;

    // CodePipeline event meta data
    let job_meta = event['CodePipeline.job']['data'];
    let input_artifacts_meta = job_meta['inputArtifacts'];
    let output_artifacts_meta = job_meta['outputArtifacts'];

    // Artifact - S3 download promises
    let await_input_artifacts = [];

    try {
        // Download all input artifacts from S3
        for (let artifact of input_artifacts_meta) {
            await_input_artifacts.push(getArtifact(artifact.location.s3Location.bucketName, artifact.location.s3Location.objectKey));
        }

        // Wait till all input artifacts are fetched.
        Promise.all(await_input_artifacts).then(input_artifacts => {
            console.log(input_artifacts.length + " artifacts fetched.");

            var new_zip = new JSZip();

            // Merge zipped input artifacts into a single zipped output artifact
            mergeArtifacts(new_zip, input_artifacts, 0).then(merged_zip => {
                // Encode the merged and zipped output artifact then upload to S3
                console.log("Uploading merged output artifact to S3...");
                merged_zip.generateAsync({ type: "nodebuffer" }).then(merged_zip_encoded => {
                    let output_artifact = output_artifacts_meta[0].location.s3Location;

                    let params = {
                        Body: merged_zip_encoded,
                        Bucket: output_artifact.bucketName,
                        ContentType: "application/zip",
                        Key: output_artifact.objectKey,
                        ServerSideEncryption: "AES256"
                    };

                    s3.putObject(params, function (error, data) {
                        if (error) {
                            console.log("Failed to upload output artifact to S3 " + error);
                            putJobFailure("Failed to upload output artifact to S3.");
                        } else {
                            putJobSuccess("Merged artifacts successfully");
                        }
                    });
                });
            }).catch((error) => {
                putJobFailure("Failed to retrieve an object from S3.");
            });
        });
    } catch (error) {
        putJobFailure("General failure: " + error);
    }
};
