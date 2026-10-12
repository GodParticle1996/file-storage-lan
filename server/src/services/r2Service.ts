import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, R2_BUCKET, versionKey } from '../config/r2.js';

export const UPLOAD_URL_TTL = 300; // 5 minutes
export const DOWNLOAD_URL_TTL = 600; // 10 minutes

export async function presignUpload(
  key: string,
  contentType: string,
  contentLengthBytes?: number,
  ttlSec = UPLOAD_URL_TTL
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLengthBytes,
  });
  return getSignedUrl(r2, cmd, { expiresIn: ttlSec });
}

export async function presignDownload(key: string, ttlSec = DOWNLOAD_URL_TTL): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, ResponseContentDisposition: `attachment; filename="${encodeURIComponent(key.split('/').pop() || 'file')}"` });
  return getSignedUrl(r2, cmd, { expiresIn: ttlSec });
}

export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  try {
    const out = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return { size: out.ContentLength ?? 0 };
  } catch (err: any) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

export function buildVersionKey(userId: string, folderId: string, fileId: string, version: number): string {
  return versionKey(userId, folderId, fileId, version);
}
