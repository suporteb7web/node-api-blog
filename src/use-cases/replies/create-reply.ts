import { AppError } from '../../errors/app-error.js';
import type { Mailer } from '../../mailer/mailer.js';
import type { PostsRepository } from '../../repositories/posts.repository.js';
import type { RepliesRepository } from '../../repositories/replies.repository.js';
import type { UsersRepository } from '../../repositories/users.repository.js';
import type { CreateReplyBody } from '../../schemas/replies.schemas.js';
import type { AuthUser } from '../../types/auth.js';

const EXCERPT_MAX_LENGTH = 200;

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
    private readonly mailer: Mailer,
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
      await this.notifyPostAuthor({
        postId: existing.id,
        postTitle: existing.title,
        postAuthorId: existing.authorId,
        replyAuthorName: author.name,
        replyContent: data.content,
      });
    }

    return reply;
  }

  private async notifyPostAuthor(input: {
    postId: number;
    postTitle: string;
    postAuthorId: number;
    replyAuthorName: string;
    replyContent: string;
  }): Promise<void> {
    try {
      const postAuthor = await this.usersRepository.findById(input.postAuthorId);
      if (!postAuthor) return;

      await this.mailer.send({
        to: postAuthor.email,
        subject: `New reply on "${input.postTitle}"`,
        text: [
          `${input.replyAuthorName} replied to your post "${input.postTitle}" (#${input.postId}):`,
          '',
          excerpt(input.replyContent),
        ].join('\n'),
      });
    } catch (error) {
      console.error('Failed to send reply notification email', error);
    }
  }
}

function excerpt(content: string): string {
  if (content.length <= EXCERPT_MAX_LENGTH) {
    return content;
  }

  return `${content.slice(0, EXCERPT_MAX_LENGTH)}...`;
}
