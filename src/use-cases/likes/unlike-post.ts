import { AppError } from '../../errors/app-error.js';
import type { LikesRepository } from '../../repositories/likes.repository.js';
import type { PostsRepository } from '../../repositories/posts.repository.js';
import type { AuthUser } from '../../types/auth.js';

type UnlikePostInput = {
  user: AuthUser;
  postId: number;
};

export class UnlikePostUseCase {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly likesRepository: LikesRepository,
  ) {}

  async execute({ user, postId }: UnlikePostInput): Promise<void> {
    const existing = await this.postsRepository.findById(postId);
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Post not found');

    await this.likesRepository.unlike(user.id, postId);
  }
}
