# S3 Object Lambda Image Transformer

This repository contains sample code for constructing a Content Delivery Network (CDN) to deliver images from S3. By utilizing S3 Object Lambda, you can transform aspects such as the image size, quality, and format. The implementation of the Lambda function uses [Sharp](https://sharp.pixelplumbing.com/).

![](/drawio/arch.drawio.png)

## Deployment Procedure

Install the npm modules.

```bash
npm install
```

This project uses the AWS CDK. If you haven't completed the bootstrap process, you can do so using the following command:

```bash
npx cdk bootstrap
```

Deploy using CDK.

```bash
npx cdk deploy
```

The URL of the ImageTransformerEndpoint displayed in the output will serve as the CDN's endpoint.

The image files placed in [`/imgs`](/imgs) will be uploaded to S3. By default, a file named [`test.png`](/imgs/test.png) is uploaded. You can verify the image display by accessing the URL below:

https://xxxxxxxxxxxxxx.cloudfront.net/test.png

(Please replace 'xxxxxxxxxxxxxx' with the appropriate value)

## Supported Query Parameters
- `width` Specifies the width
- `height` Specifies the height
- `fit` Specifies how to resize if both width and height are specified
  - For more details, see https://sharp.pixelplumbing.com/api-resize
- `quality` Specifies image quality (default=85)
- `format` Specifies the format (jpeg, png, gif, webp, avif)
- `auto` Convert to specified format by looking at the Accept header (webp, avif)

**Example: Set the width to 300px**
https://xxxxxxxxxxxxxx.cloudfront.net/test.png?width=300

**Example: Convert png to jpeg**
https://xxxxxxxxxxxxxx.cloudfront.net/test.png?format=jpeg

**Example: Check the Accept header and convert to webp if possible**
https://xxxxxxxxxxxxxx.cloudfront.net/test.png?auto=webp

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

