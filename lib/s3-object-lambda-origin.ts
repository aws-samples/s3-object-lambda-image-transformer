import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

export interface S3ObjectLambdaOriginProps extends cloudfront.OriginProps {}

export class S3ObjectLambdaOrigin extends cloudfront.OriginBase {
  constructor(domainName: string, private readonly props: S3ObjectLambdaOriginProps = {}) {
    super(domainName, props);
  }

  protected renderS3OriginConfig(): cloudfront.CfnDistribution.S3OriginConfigProperty | undefined {
    return {
      originAccessIdentity: '',
    }
  }
}
