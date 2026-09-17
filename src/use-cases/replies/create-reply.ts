import { AppError } from '../../errors/app-error.js';
import type { PostsRepository } from '../../repositories/posts.repository.js';
import type { RepliesRepository } from '../../repositories/replies.repository.js';
import type { ReplyNotificationJobsRepository } from '../../repositories/reply-notification-jobs.repository.js';
import type { UsersRepository } from '../../repositories/users.repository.js';
import type { CreateReplyBody } from '../../schemas/replies.schemas.js';
import type { AuthUser } from '../../types/auth.js';

type CreateReplyInput = {
  author: AuthUser;
  postId: number;
  data: CreateReplyBody;
};

export class CreateReplyUseCase {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly repliesRepository: RepliesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly jobsRepository: ReplyNotificationJobsRepository,
  ) {}

  async execute({ author, postId, data }: CreateReplyInput) {
    const existing = await this.postsRepository.findById(postId);
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Post not found');

    const reply = await this.repliesRepository.create({
      content: data.content,
      authorId: author.id,
      postId,
    });

    if (author.id !== existing.authorId) {
      await this.enqueueNotification({
        postId: existing.id,
        postTitle: existing.title,
        postAuthorId: existing.authorId,
        replyAuthorName: author.name,
        replyContent: data.content,
      });
    }

    return reply;
  }

  private async enqueueNotification(input: {
    postId: number;
    postTitle: string;
    postAuthorId: number;
    replyAuthorName: string;
    replyContent: string;
  }): Promise<void> {
    try {
      const postAuthor = await this.usersRepository.findById(input.postAuthorId);
      if (!postAuthor) return;

      await this.jobsRepository.enqueue({
        to: postAuthor.email,
        postId: input.postId,
        postTitle: input.postTitle,
        replyAuthorName: input.replyAuthorName,
        replyContent: input.replyContent,
      });
    } catch (error) {
      console.error('Failed to enqueue reply notification email', error);
    }
  }
}
