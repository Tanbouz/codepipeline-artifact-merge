# CodePipeline Artifact Merge

Merge artifacts in AWS CodePipeline into a single artifact using AWS Lambda.

##  1. Use cases

#### 1.1 Generic merging of artifacts

This example will merge input artifacts `a.zip` & `b.zip` using **root merge** then merge the resulting output artifact `foo` with `c.zip` using **subfolder merge** mode. You can use either or both modes in your pipeline.

S3 sources
```
a.zip
├──shared
│   └──a.txt
└──a.txt

b.zip
├──shared
│   └──b.txt
└──b.txt

c.zip
└──c.txt
```

Step 1 - Root merge (Default)

Input Artifacts: `a.zip` & `b.zip`

Resulting output artifact of `MergeRoot` stage:

```
foo
├──shared
│   ├──a.txt
│   └──b.txt
├──a.txt
├──b.txt
├──.revision-id-a
└──.revision-id-b
```
> The [revision ID]((https://docs.aws.amazon.com/codepipeline/latest/APIReference/API_Artifact.html#CodePipeline-Type-Artifact-revision)) 
of each input artifact is included in the file .revision-id-{name-of-input-artifact}

Step 2 - Subfolder merge (see *Modes*)

Input Artifacts: `foo` & `c.zip`

Resulting output artifact of `MergeIntoSubfolders` stage:
```
bar
├──foo
│   ├──shared
│   │   ├──a.txt
│   │   └──b.txt
│   ├──a.txt
│   ├──b.txt
│   ├──.revision-id-a
│   ├──.revision-id-b
│   └──.revision-id
└──c
    │──c.txt
    └──.revision-id
```
> Note that the folder name `foo` will be the name of the configured output artifact name in Step 1

> The [revision ID]((https://docs.aws.amazon.com/codepipeline/latest/APIReference/API_Artifact.html#CodePipeline-Type-Artifact-revision)) 
of each input artifact is included in the file .revision-id

![Generic merge example screenshot](/images/merge-example-1.png)

#### 1.2 CodeDeploy use case

Split CodeDeploy deployment scripts, appspec.yml config and your application code into different repositories or S3 buckets. 

![CodeDeploy use case diagram](/images/codedeploy-example-1.png)

Instead of including __AWS CodeDeploy's__ `appspec.yml` and `deployment scripts` in your application code repository, you can store them in a separate location (S3 or git) then merge them with application code during deployment.

* Allows you to use different `appspec.yml` or `deployment scripts` for different environments (production/staging)

* Host a library of common deployments scripts in a single independent repository without the need to maintain or include deployment scripts in each of your application repositories.

## 2. Usage

After you deploy the CodePipeline Artifact Merge function (see *Deployment* below).

* Create a new __Invoke__ action in your pipeline with provider __AWS Lambda__ then select CodePipeline Artifact Merge function.
> Make sure your CodePipeline's role has the necessary permissions to invoke the Lambda function
* Select all input artifacts/sources you would like to merge and 
* Configure the name of the merged output artifact to be used in later stages of your pipeline.

#### 2.1 Modes
* **Root merge (default)**
Combines different artifacts at the root level of the directories

* **Subfolder merge**
Have each input artifact contained in its own folder within the output artifact zip, with the folder name being the input artifact name itself. To set this option, enter the JSON string `{ "subfolder": true }` as an input parameter to the lambda.

## 3. Deployment

#### 3.1 AWS Serverless Application Repository (Preview)

Register for preview https://aws.amazon.com/serverless/serverlessrepo/

Deploy using [AWS Serverless Application Repository](https://serverlessrepo.aws.amazon.com/#/applications/arn:aws:serverlessrepo:us-east-1:775015977546:applications~codepipeline-artifact-merge)


**Important** If you deploy through AWS Serverless Application Repository, you have to manually add permissions to the function's role so as Lambda can notify CodePipeline about its status. Unfortunately this can't be automated at the moment when using AWS Serverless Application Repository.

Example policy:
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "codepipeline:PutJobSuccessResult",
                "codepipeline:PutJobFailureResult"
            ],
            "Resource": "*",
            "Effect": "Allow"
        }
    ]
}
```

#### 3.2 Manual procedure (Linux/Mac with nodejs/npm installed)

* `git clone`

* `cd codepipeline-artifact-merge`

* Package lambda function
```
aws cloudformation package --template-file dist/deploy.yml --output-template-file tmp/deploy.yml  --region us-east-1 --s3-bucket codepipeline-artifact-merge
```
> Change the `--region` as required.

> `--s3-bucket` Create or use an existing bucket to temporarily store the packaged lambda function.

> Make sure your AWS CLI user has the necessary permissions

* Deploy using CloudFormation
```
aws cloudformation deploy --parameter-overrides FunctionName=CodePipelineArtifactMerge ArtifactStore=my-pipeline-bucket --template-file tmp/deploy.yml --stack-name codepipeline-artifact-merge --capabilities CAPABILITY_IAM --region us-east-1
```
> Change the `--region` as required.

> Change `ArtifactStore`, the S3 bucket name configured for CodePipeline.

> Make sure your AWS CLI user has the necessary permissions.

> [Optional] Change CloudFormation stack name `--stack-name`

> [Optional] Change `FunctionName` to change Lambda function name to be used later as reference in CodePipeline invoke action.

### 4. Notes
 * Even though there is no hard-limit on how many artifacts the function can merge, it is currently limited by CodePipeline & Lambda integration restriction of 5 input artifacts. ( Cascade merge? )
 * If your application code size is large, maybe tweaking Lambda's __Memory__ and __Timeout__ can help.