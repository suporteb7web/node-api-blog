import { AppError } from '../../errors/app-error.js';
import type { LikesRepository } from '../../repositories/likes.repository.js';
import type { PostsRepository } from '../../repositories/posts.repository.js';
import type { RepliesRepository } from '../../repositories/replies.repository.js';

type GetPostInput = {
  postId: number;
  userId?: number;
};

export class GetPostUseCase {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly likesRepository: LikesRepository,
    private readonly repliesRepository: RepliesRepository,
  ) {}

  async execute({ postId, userId }: GetPostInput) {
    const row = await this.postsRepository.findWithAuthorById(postId);

    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Post not found');
    }

    const [likesCount, likedByMe, replies] = await Promise.all([
      this.likesRepository.countByPostId(postId),
      userId ? this.likesRepository.exists(userId, postId) : Promise.resolve(false),
      this.repliesRepository.listByPostId(postId),
    ]);

    return { ...row, likesCount, likedByMe, replies };
  }
}
