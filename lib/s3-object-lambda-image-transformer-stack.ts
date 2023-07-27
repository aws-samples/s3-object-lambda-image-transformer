import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3ObjectLambdaCloudFront } from './s3-object-lambda-cloudfront';

export class S3ObjectLambdaImageTransformerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const assetBucket = new s3.Bucket(this, 'AssetBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new s3Deploy.BucketDeployment(this, 'DeployImages', {
      sources: [s3Deploy.Source.asset('./imgs')],
      destinationBucket: assetBucket,
      memoryLimit: 1024,
    });

    const transformer = new lambdaNode.NodejsFunction(this, 'TransformNode', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: './lambda/transformer.ts',
      depsLockFilePath: './lambda/package-lock.json',
      bundling: {
        nodeModules: ['sharp'],
        forceDockerBundling: true,
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 1024,
    });

    const cachePolicy = new cloudfront.CachePolicy(this, 'CachePolicy', {
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Accept'),
      defaultTtl: cdk.Duration.minutes(1),
    });

    const originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'OriginRequestPolicy', {});
    const cloudFrontImageTransformer = new S3ObjectLambdaCloudFront(this, 'CloudFrontImageTransformer', {
      bucket: assetBucket,
      func: transformer,
      behaviorOptions: {
        cachePolicy: cachePolicy,
        originRequestPolicy: originRequestPolicy,
      },
    });

    new cdk.CfnOutput(this, 'ImageTransformerEndpoint', {
      value: `https://${cloudFrontImageTransformer.distribution.domainName}`,
    });
  }
}
