import { AppError } from '../../errors/app-error.js';
import type { PostsRepository } from '../../repositories/posts.repository.js';
import type { ImageStorage } from '../../storage/image-storage.js';
import type { AuthUser } from '../../types/auth.js';

type UpdatePostImageInput = {
  author: AuthUser;
  postId: number;
  buffer?: Buffer;
};

export class UpdatePostImageUseCase {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly imageStorage: ImageStorage,
  ) {}

  async execute({ author, postId, buffer }: UpdatePostImageInput) {
    if (!buffer) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Image file is required', [
        { path: 'image', message: 'Image file is required' },
      ]);
    }

    const existing = await this.postsRepository.findById(postId);

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Post not found');
    }

    if (existing.authorId !== author.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only update your own posts');
    }

    let photoPath: string;

    try {
      photoPath = await this.imageStorage.savePostImage(buffer);
    } catch {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid image', [
        { path: 'image', message: 'Invalid image' },
      ]);
    }

    await this.postsRepository.updatePhotoPath(postId, photoPath);

    if (existing.photoPath) {
      await this.imageStorage.delete(existing.photoPath);
    }

    return { ...existing, photoPath };
  }
}
