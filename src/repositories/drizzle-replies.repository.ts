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
}
