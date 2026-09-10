import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

export function getTestUploadsDir(): string {
  return path.resolve(process.env.UPLOADS_DIR ?? 'uploads-test');
}

export async function cleanUploads(): Promise<void> {
  const dir = getTestUploadsDir();
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, 'avatars'), { recursive: true });
  await mkdir(path.join(dir, 'posts'), { recursive: true });
}
