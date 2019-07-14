**v1.4.0 - 14th Jul 2019 - CodePipeline Policy and Nodejs10.x upgrade**
* Upgrade to Nodejs10.x
* Use `CodePipelineLambdaExecutionPolicy` to allow Lambda function to report job status back to CodePipeline without the need to add custom IAM policy manually.
* Rename CloudFormation/SAM `deploy.yml` template to `template.yaml`
* Update node dependencies

**v1.3.0 - gzip support & NodeJs 8.10**

* Accepts gzipped tar balls as input artifacts
* Upgraded Lambda function to use NodeJS 8.10
* Lambda default memory size is now 512 mb
* Default timeout for this lambda function is now 60 seconds.

**v1.2.1 - Fix to handle file/folder permissions**

* Explicitly state the platform when generating the zip so it knows how to handle and maintain file/folder permissions within the resulting zip file.

**v1.2.0 - Revisions**

New feature: Revisions

Creates a file with the revision-id of the input artifact in the output. This allows the succeeding codepipeline stages such as CodeBuild to use the git/S3 revision number for versioning. To set this option, enter the JSON string { "revisions": true } as an input parameter to lambda.

**v1.1.0 - Subfolder merge & tests**

New feature: Subfolder merge mode

Option to have each input artifact contained in its own folder within the output artifact zip, with the folder name being the input artifact name itself. To set this option, enter the JSON string '{ "subfolder": true }' as an input parameter to the lambda.

Tests:

- mergeArtifacts test
- mergeArtifactsWithSubFolder test
- Options parameter validation test

**v1.0.7 - Handle missing input/output artifacts**

* If no input artifacts are configured, an output artifact won't be uploaded and the pipeline will continue successfully.
* If a single input artifact is defined, it will be passed as an output artifact.
* An output artifact must be configured in CodePipeline. Otherwise, the pipeline will fail.

**v1.0.6 - SSE S3 detection**
* Encrypt output artifacts using the same S3 Server Side Encryption type of the input artifacts. CodePipelines created through AWS Console restrict their S3 buckets policies to aws:kms encryption.
* Removed lambda parameter based encryption configuration.