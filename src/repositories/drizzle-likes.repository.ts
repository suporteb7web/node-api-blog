import { db } from '../db/index.js';
import { likes } from '../db/schema.js';
import type { LikesRepository } from './likes.repository.js';

export class DrizzleLikesRepository implements LikesRepository {
  async like(userId: number, postId: number): Promise<void> {
    await db.insert(likes).values({ userId, postId }).onConflictDoNothing();
  }
}
