import { AppError } from '../../errors/app-error.js';
import type { PostsRepository } from '../../repositories/posts.repository.js';
import type { RepliesRepository } from '../../repositories/replies.repository.js';
import type { AuthUser } from '../../types/auth.js';
import { assertPostVisible } from '../posts/assert-post-visible.js';

type DeleteReplyInput = {
  author: AuthUser;
  postId: number;
  replyId: number;
};

export class DeleteReplyUseCase {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly repliesRepository: RepliesRepository,
  ) {}

  async execute({ author, postId, replyId }: DeleteReplyInput) {
    const post = await this.postsRepository.findById(postId);
    assertPostVisible(post, author.premium);

    const reply = await this.repliesRepository.findById(replyId);
    if (!reply || reply.postId !== postId) {
      throw new AppError(404, 'NOT_FOUND', 'Reply not found');
    }

    if (reply.authorId !== author.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only delete your own replies');
    }

    await this.repliesRepository.delete(replyId);
  }
}
