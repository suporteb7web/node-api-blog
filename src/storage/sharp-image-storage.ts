import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { ImageStorage } from './image-storage.js';
import { getUploadsDir } from './uploads-dir.js';

const AVATAR_SIZE = 200;
const POST_IMAGE_MAX_WIDTH = 1280;
const POST_IMAGE_MAX_HEIGHT = 720;

export class SharpImageStorage implements ImageStorage {
  constructor(private readonly uploadsDir = getUploadsDir()) {}

  async saveAvatar(buffer: Buffer): Promise<string> {
    const filename = `${randomUUID()}.jpg`;
    const relativePath = path.posix.join('avatars', filename);
    const absolutePath = path.join(this.uploadsDir, relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });

    await sharp(buffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toFile(absolutePath);

    return relativePath;
  }

  async savePostImage(buffer: Buffer): Promise<string> {
    const filename = `${randomUUID()}.jpg`;
    const relativePath = path.posix.join('posts', filename);
    const absolutePath = path.join(this.uploadsDir, relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });

    await sharp(buffer)
      .resize(POST_IMAGE_MAX_WIDTH, POST_IMAGE_MAX_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toFile(absolutePath);

    return relativePath;
  }

  async delete(relativePath: string): Promise<void> {
    const absolutePath = path.join(this.uploadsDir, relativePath);
    await unlink(absolutePath).catch(() => undefined);
  }
}
