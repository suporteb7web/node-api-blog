import type { LikesRepository } from '../../repositories/likes.repository.js';
import type { PostsRepository } from '../../repositories/posts.repository.js';
import type { AuthUser } from '../../types/auth.js';
import { assertPostVisible } from '../posts/assert-post-visible.js';

type LikePostInput = {
  user: AuthUser;
  postId: number;
};

export class LikePostUseCase {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly likesRepository: LikesRepository,
  ) {}

  async execute({ user, postId }: LikePostInput): Promise<void> {
    const existing = await this.postsRepository.findById(postId);
    assertPostVisible(existing, user.premium);

    await this.likesRepository.like(user.id, postId);
  }
}
