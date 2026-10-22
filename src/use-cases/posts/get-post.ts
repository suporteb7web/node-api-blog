import type { LikesRepository } from '../../repositories/likes.repository.js';
import type { PostsRepository } from '../../repositories/posts.repository.js';
import type { RepliesRepository } from '../../repositories/replies.repository.js';
import { assertPostVisible } from './assert-post-visible.js';

type GetPostInput = {
  postId: number;
  userId?: number;
  viewerIsPremium: boolean;
};

export class GetPostUseCase {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly likesRepository: LikesRepository,
    private readonly repliesRepository: RepliesRepository,
  ) {}

  async execute({ postId, userId, viewerIsPremium }: GetPostInput) {
    const row = await this.postsRepository.findWithAuthorById(postId);
    assertPostVisible(row, viewerIsPremium);

    const [likesCount, likedByMe, replies] = await Promise.all([
      this.likesRepository.countByPostId(postId),
      userId ? this.likesRepository.exists(userId, postId) : Promise.resolve(false),
      this.repliesRepository.listByPostId(postId),
    ]);

    return { ...row, likesCount, likedByMe, replies };
  }
}
