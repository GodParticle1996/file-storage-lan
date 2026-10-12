import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

export const r2 = new S3Client({
  region: env.R2_REGION,
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});

export const R2_BUCKET = env.R2_BUCKET;

/** Build the object key for a file version: u/<userId>/<folderId>/<fileId>/v<n> */
export function versionKey(userId: string, folderId: string, fileId: string, version: number): string {
  return `u/${userId}/${folderId}/${fileId}/v${version}`;
}

/** Build the object key prefix for listing all versions of a file: u/<userId>/<folderId>/<fileId>/ */
export function versionPrefix(userId: string, folderId: string, fileId: string): string {
  return `u/${userId}/${folderId}/${fileId}/`;
}
