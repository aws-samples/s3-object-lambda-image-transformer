import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3objectlamda from 'aws-cdk-lib/aws-s3objectlambda';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3ObjectLambdaOrigin } from './s3-object-lambda-origin';

export interface S3ObjectLambdaCloudFrontProps {
  func: lambda.IFunction
  bucket: s3.Bucket
  behaviorOptions: Omit<cloudfront.BehaviorOptions, 'origin'>,
}

export class S3ObjectLambdaCloudFront extends Construct {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: S3ObjectLambdaCloudFrontProps) {
    super(scope, id);

    const account = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    props.func.role?.attachInlinePolicy(new iam.Policy(this, 'WriteGetObjectResponsePolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['s3-object-lambda:WriteGetObjectResponse'],
          resources: ['*'],
        }),
      ],
    }));

    props.func.addPermission('AllowCloudFrontInvoke', {
      principal: new iam.ServicePrincipal('cloudfront.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });

    props.bucket.grantRead(props.func);

    props.bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['*'],
      principals: [new iam.ArnPrincipal('*')],
      resources: [
        props.bucket.bucketArn,
        props.bucket.arnForObjects('*'),
      ],
      conditions: {
        'StringEquals': {
          's3:DataAccessPointAccount': account,
        },
      },
    }));

    const accessPointName = id.toLowerCase();
    const accessPoint = new s3.CfnAccessPoint(this, 'AccessPoint', {
      name: accessPointName,
      bucket: props.bucket.bucketName,
      policy: {
        Version: '2012-10-17',
        Id: 'default',
        Statement: [
          {
            Sid: "s3objlambda",
            Effect: "Allow",
            Principal: {
              Service: "cloudfront.amazonaws.com"
            },
            Action: "s3:*",
            Resource: [
              `arn:aws:s3:${region}:${account}:accesspoint/${accessPointName}`,
              `arn:aws:s3:${region}:${account}:accesspoint/${accessPointName}/object/*`,
            ],
            Condition: {
              "ForAnyValue:StringEquals": {
                "aws:CalledVia": "s3-object-lambda.amazonaws.com"
              },
            },
          },
        ],
      },
    });

    const objectLambdaAccessPoint = new s3objectlamda.CfnAccessPoint(this, 'ObjectLambdaAccessPoint', {
      objectLambdaConfiguration: {
        supportingAccessPoint: cdk.Token.asString(accessPoint.getAtt('Arn')),
        transformationConfigurations: [
          {
            actions: ['GetObject'],
            contentTransformation: {
              AwsLambda: {
                FunctionArn: props.func.functionArn,
              },
            },
          },
        ],
      },
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new S3ObjectLambdaOrigin(
          `${cdk.Token.asString(objectLambdaAccessPoint.getAtt('Alias.Value'))}.s3.${region}.amazonaws.com`
        ),
        ...props.behaviorOptions,
      },
    });

    new s3objectlamda.CfnAccessPointPolicy(this, 'ObjectLambdaAccessPointPolicy', {
      objectLambdaAccessPoint: objectLambdaAccessPoint.ref,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'cloudfront.amazonaws.com',
            },
            Action: 's3-object-lambda:Get*',
            Resource: cdk.Token.asString(objectLambdaAccessPoint.getAtt('Arn')),
            Condition: {
              StringEquals: {
                'aws:SourceArn': `arn:aws:cloudfront::${account}:distribution/${distribution.distributionId}`,
              },
            },
          },
        ],
      },
    });

    const originAccessControl = new cloudfront.CfnOriginAccessControl(this, 'OriginAccessControl', {
      originAccessControlConfig: {
        name: id,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      }
    });

    (distribution.node.defaultChild as cloudfront.CfnDistribution).addPropertyOverride(
      'DistributionConfig.Origins.0.OriginAccessControlId',
      originAccessControl.attrId,
    );

    this.distribution = distribution;
  }
}
