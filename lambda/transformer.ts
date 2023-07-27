import sharp, { Sharp } from 'sharp';
import { S3 } from '@aws-sdk/client-s3';

interface GetObjectContext {
  inputS3Url: string
  outputRoute: string
  outputToken: string
}

interface UserRequest {
  url: string
  headers: {[key: string]: string}
}

interface S3ObjectLambdaEvent {
  getObjectContext: GetObjectContext
  userRequest: UserRequest
}

const convertToWebp = (headers: {[key: string]: string}) => {
  if (headers.Accept) {
    const convert = headers.Accept.split(',').some((acceptHeader) => {
      return acceptHeader.startsWith('image/webp') ||
        acceptHeader.startsWith('image/*') ||
        acceptHeader.startsWith('*/*')
    });

    if (convert) {
      return true;
    }
  }

  return false;
}

const convertToAvif = (headers: {[key: string]: string}) => {
  if (headers.Accept) {
    const convert = headers.Accept.split(',').some((acceptHeader) => {
      return acceptHeader.startsWith('image/avif') ||
        acceptHeader.startsWith('image/*') ||
        acceptHeader.startsWith('*/*')
    });

    if (convert) {
      return true;
    }
  }

  return false;
}

exports.handler = async (event: S3ObjectLambdaEvent): Promise<void> => {
  console.log(event);

  const s3 = new S3({});

  try {
    const data = await fetch(event.getObjectContext.inputS3Url);
    const buffer = Buffer.from(await data.arrayBuffer());
    const query = new URL(event.userRequest.url).searchParams;

    let s: Sharp = sharp(buffer, { animated: true });

    if (query.has('width') || query.has('height')) {
      s = s.resize({
        width: query.has('width') ? Number(query.get('width')) : undefined,
        height: query.has('height') ? Number(query.get('height')) : undefined,
        fit: query.get('fit') ?? 'cover',
      });
    }

    const quality = Number(query.get('quality') ?? '85');

    let format = query.get('format') ?? (await s.metadata()).format.toLowerCase();

    if (query.get('auto') === 'webp' && convertToWebp(event.userRequest.headers)) {
      format = 'webp';
    }

    if (query.get('auto') === 'avif' && convertToAvif(event.userRequest.headers)) {
      format = 'avif';
    }

    let transformed: Buffer;

    switch (format) {
      case 'jpeg':
      case 'jpg':
        // https://sharp.pixelplumbing.com/api-output#jpeg
        transformed = await s.jpeg({ quality }).toBuffer();
        break;
      case 'png':
        // https://sharp.pixelplumbing.com/api-output#png
        transformed = await s.png({ quality }).toBuffer();
        break;
      case 'gif':
        // https://sharp.pixelplumbing.com/api-output#gif
        transformed = await s.gif().toBuffer();
        break;
      case 'webp':
        // https://sharp.pixelplumbing.com/api-output#webp
        transformed = await s.webp({ quality, force: true }).toBuffer();
        break;
      case 'avif':
        // https://sharp.pixelplumbing.com/api-output#avif
        transformed = await s.avif({ quality }).toBuffer();
        break;
      default:
        await s3.writeGetObjectResponse({
          StatusCode: 400,
          RequestRoute: event.getObjectContext.outputRoute,
          RequestToken: event.getObjectContext.outputToken,
          ErrorCode: 'UnknownFormat',
          ErrorMessage: `Unknown format ${format}`,
        });
        return;
    }

    await s3.writeGetObjectResponse({
      Body: transformed,
      RequestRoute: event.getObjectContext.outputRoute,
      RequestToken: event.getObjectContext.outputToken,
      ContentType: `image/${format}`,
    });
  } catch (e: unknown) {
    console.error('---------------------');
    console.error(e);
    console.error('---------------------');

    if (e instanceof Error) {
      await s3.writeGetObjectResponse({
        StatusCode: 400,
        RequestRoute: event.getObjectContext.outputRoute,
        RequestToken: event.getObjectContext.outputToken,
        ErrorCode: e.name,
        ErrorMessage: e.message ?? '',
        ContentLength: (e.message ?? '').length,
      });
    }
  }
}
