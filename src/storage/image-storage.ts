export interface ImageStorage {
  saveAvatar(buffer: Buffer): Promise<string>;
  savePostImage(buffer: Buffer): Promise<string>;
  delete(relativePath: string): Promise<void>;
}
