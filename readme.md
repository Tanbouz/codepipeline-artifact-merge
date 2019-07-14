# CodePipeline Artifact Merge [![CircleCI](https://circleci.com/gh/Tanbouz/codepipeline-artifact-merge.svg?style=svg)](https://circleci.com/gh/Tanbouz/codepipeline-artifact-merge)

Merge artifacts in AWS CodePipeline into a single artifact using AWS Lambda.

###  Examples:

Merge input artifacts `a.zip` & `b.zip` using **root merge** then merge the resulting output artifact `foo` with `c.zip` using **subfolder merge** mode. You can use either or both modes in your pipeline.

Example S3 sources
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

#### Root merge with revisions

Input artifacts: `a.zip` & `b.zip`

Output artifact:

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

#### Subfolder merge with revisions (see *Modes*)

Input artifacts: `foo` & `c.zip`

Output artifact:
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

#### CodeDeploy use case

Split CodeDeploy deployment scripts, appspec.yml config and your application code into different repositories or S3 buckets. 

![CodeDeploy use case diagram](/images/codedeploy-example-1.png)

Instead of including __AWS CodeDeploy's__ `appspec.yml` and `deployment scripts` in your application code repository, you can store them in a separate location (S3 or git) then merge them with application code during deployment.

* Option to use different `appspec.yml` or `deployment scripts` for different environments (production/staging)

* Host a library of common deployments scripts in a single independent repository without the need to maintain or include deployment scripts in each of your application repositories.

## 2. Usage

After deploying the CodePipeline Artifact Merge function (see *Deployment* below).

* Create a new __Invoke__ action in your pipeline with provider __AWS Lambda__ then select CodePipeline Artifact Merge function.
> Make sure your CodePipeline's role has the necessary permissions to invoke the Lambda function
* Select all input artifacts/sources you would like to merge and 
* Configure the name of the merged output artifact to be used in later stages of your pipeline.

### Modes
* **Root merge (default)**
Combines different artifacts at the root level of the directories

* **Subfolder merge**
Have each input artifact contained in its own folder within the output artifact zip, with the folder name being the input artifact name itself. To set this option, enter the JSON string `{ "subfolder": true }` as an input parameter to lambda.

* **Revisions**
Creates a file with the revision-id of the input artifact in the output. This allows the succeeding codepipeline stages such as CodeBuild to use the git/S3 revision number for versioning. To set this option, enter the JSON string `{ "revisions": true }` as an input parameter to lambda. Or `{ "subfolder": true, "revisions": true }` if using subfolder merge too.

## 3. Deployment

#### AWS Serverless Application Repository

Deploy using [AWS Serverless Application Repository](https://serverlessrepo.aws.amazon.com/#/applications/arn:aws:serverlessrepo:us-east-1:775015977546:applications~codepipeline-artifact-merge)

#### Using AWS CLI

1- `npm run build`

2- Package lambda function

`aws cloudformation package --template-file dist/template.yaml --output-template-file dist/packaged.yaml --s3-bucket codepipeline-artifact-merge --region us-east-1`

> Change the `--region` as required.
> Set `--s3-bucket` to a new or existing bucket to store the packaged lambda function

3- Deploy using CloudFormation

`aws cloudformation deploy --template-file dist/packaged.yaml --stack-name codepipeline-artifact-merge --parameter-overrides FunctionName=CodePipelineArtifactMerge ArtifactStore=codepipeline-bucket --capabilities CAPABILITY_IAM --region us-east-1`

> `ArtifactStore`, the S3 bucket name configured for CodePipeline.

### 4. Notes
 * Even though there is no hard-limit on how many artifacts the function can merge, it is currently limited by CodePipeline & Lambda integration restriction of 5 input artifacts. ( Cascade merge? )
 * If your application code size is large, maybe tweaking Lambda's __Memory__ and __Timeout__ can help.
 * Revisions & cascade merge: using revisions option on a merge action that has an input artifact from a previous merge action might result in revision files with a null value or empty content.