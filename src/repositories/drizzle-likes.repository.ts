import { and, count, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { likes } from '../db/schema.js';
import type { LikesRepository } from './likes.repository.js';

export class DrizzleLikesRepository implements LikesRepository {
  async like(userId: number, postId: number): Promise<void> {
    await db.insert(likes).values({ userId, postId }).onConflictDoNothing();
  }

  async unlike(userId: number, postId: number): Promise<void> {
    await db.delete(likes).where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
  }

  async countByPostId(postId: number): Promise<number> {
    const [row] = await db.select({ total: count() }).from(likes).where(eq(likes.postId, postId));

    return row?.total ?? 0;
  }

  async countByPostIds(postIds: number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>(postIds.map((id) => [id, 0]));

    if (postIds.length === 0) {
      return counts;
    }

    const rows = await db
      .select({
        postId: likes.postId,
        total: count(),
      })
      .from(likes)
      .where(inArray(likes.postId, postIds))
      .groupBy(likes.postId);

    for (const row of rows) {
      counts.set(row.postId, row.total);
    }

    return counts;
  }

  async exists(userId: number, postId: number): Promise<boolean> {
    const row = await db.query.likes.findFirst({
      where: and(eq(likes.userId, userId), eq(likes.postId, postId)),
    });

    return row !== undefined;
  }
}
