import path from 'node:path';

export function getUploadsDir(): string {
  if (process.env.UPLOADS_DIR) {
    return path.resolve(process.env.UPLOADS_DIR);
  }

  if (process.env.NODE_ENV === 'test') {
    return path.resolve('uploads-test');
  }

  return path.resolve('uploads');
}
