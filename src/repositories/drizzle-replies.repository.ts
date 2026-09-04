import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { replies } from '../db/schema.js';
import type { CreateReplyData, RepliesRepository, ReplyRecord } from './replies.repository.js';

export class DrizzleRepliesRepository implements RepliesRepository {
  async create(data: CreateReplyData): Promise<Omit<ReplyRecord, 'authorId' | 'postId'>> {
    const [reply] = await db
      .insert(replies)
      .values({
        content: data.content,
        authorId: data.authorId,
        postId: data.postId,
      })
      .returning({
        id: replies.id,
        content: replies.content,
        createdAt: replies.createdAt,
      });

    return reply;
  }

  async findById(replyId: number): Promise<ReplyRecord | null> {
    const existing = await db.query.replies.findFirst({
      where: eq(replies.id, replyId),
    });

    return existing ?? null;
  }

  async delete(replyId: number): Promise<void> {
    await db.delete(replies).where(eq(replies.id, replyId));
  }
}
