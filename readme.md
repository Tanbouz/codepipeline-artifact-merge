# CodePipeline Artifact Merge

Merge artifacts in AWS CodePipeline into a single artifact using AWS Lambda.

##  1. Use cases
![Use case diagram](/images/usecase.png)
Split CodeDeploy deployment scripts, appspec.yml config and your application code into different repositories or S3 buckets. 

Use case diagram: https://github.com/Tanbouz/codepipeline-artifact-merge/raw/master/images/usecase.png

#### - *Generic merging of artifacts*

#### - *CodeDeploy flexibility*

Instead of including __AWS CodeDeploy's__ `appspec.yml` and `deployment scripts` in the application code repository, you can store them in a separate location (git or s3 for example) then merge them with application code during deployment.

This allows you to use different `appspec.yml` or `deployment scripts` for different environments *staging, production* for instance.

Or host a library of common deployments scripts in a single independent repository without the need to maintain or include deployment scripts in each of the application repositories.

## 2. Usage

After you deploy the application (see below).

* Create an Invoke action in CodePipeline and select CodePipeline Artifact Merge function. 
* Select all input artifacts/sources you would like to merge and 
* Configure the name of the merged output artifact to be used in later stages of your pipeline.

## 3. Deployment

#### 3.1 AWS Serverless Application Repository (Preview)

Find on https://aws.amazon.com/serverless/serverlessrepo/

#### 3.2 Manual procedure (Linux/Mac with nodejs/npm installed)

1. `git clone`

2. `cd codepipeline-artifact-merge`

3. package
```
aws cloudformation package --template-file dist/deploy.yml --output-template-file tmp/deploy.yml  --region us-east-1 --s3-bucket codepipeline-artifact-merge
```
> Change the `--region` to the region you are using.

> `--s3-bucket` Create or use an existing bucket to temporarily store the packaged lambda function.

> Make sure your AWS CLI user has the necessary permissions

4. Deploy using CloudFormation
```
aws cloudformation deploy --parameter-overrides FunctionName=CodePipelineArtifactMerge ArtifactStore=my-pipeline-bucket --template-file tmp/deploy.yml --stack-name codepipeline-artifact-merge --capabilities CAPABILITY_IAM
```
> Change CloudFormation stack name `--stack-name`

> Change `FunctionName` to change Lambda function name to be used later as reference in CodePipeline invoke action.

> Change `ArtifactStore`, the S3 bucket name configured for CodePipeline.

> Make sure your AWS CLI user has the necessary permissions.


5. Create a new stage in your CodePipeline
> Make sure your CodePipeline's role has the necessary permissions to invoke the Lambda function

6. Create a new __Invoke__ action inside the new stage with provider __AWS Lambda__.

7. Fill in action name, select lambda function name and input artifacts.

### 4. Notes
 * __CodePipeline Artifact Merge__ combines different artifacts at the root level of the directories.
 * Even though there is no hard-limit on how many artifacts the function can merge, it is currently limited by CodePipeline & Lambda integration restriction of 5 input artifacts. ( Cascade merge? )
 * If your application code size is large, maybe tweaking Lambda's __Memory__ and __Timeout__ can help.