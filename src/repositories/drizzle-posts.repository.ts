import { count, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts, users } from '../db/schema.js';
import type {
  CreatePostData,
  ListWithAuthorResult,
  PostRecord,
  PostsRepository,
  PostWithAuthorRow,
  UpdatePostData,
} from './posts.repository.js';

export class DrizzlePostsRepository implements PostsRepository {
  async listWithAuthor(page: number, limit: number): Promise<ListWithAuthorResult> {
    const offset = (page - 1) * limit;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: posts.id,
          title: posts.title,
          content: posts.content,
          createdAt: posts.createdAt,
          authorId: users.id,
          authorName: users.name,
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(posts),
    ]);

    return { rows, total };
  }

  async findWithAuthorById(postId: number): Promise<PostWithAuthorRow | null> {
    const [row] = await db
      .select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        createdAt: posts.createdAt,
        authorId: users.id,
        authorName: users.name,
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.id, postId))
      .limit(1);

    return row ?? null;
  }

  async create(data: CreatePostData): Promise<Omit<PostRecord, 'authorId'>> {
    const [post] = await db
      .insert(posts)
      .values({
        title: data.title,
        content: data.content,
        authorId: data.authorId,
      })
      .returning({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        createdAt: posts.createdAt,
      });

    return post;
  }

  async findById(postId: number): Promise<PostRecord | null> {
    const existing = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    return existing ?? null;
  }

  async update(postId: number, data: UpdatePostData): Promise<Omit<PostRecord, 'authorId'>> {
    const [post] = await db
      .update(posts)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
      })
      .where(eq(posts.id, postId))
      .returning({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        createdAt: posts.createdAt,
      });

    return post;
  }

  async delete(postId: number): Promise<void> {
    await db.delete(posts).where(eq(posts.id, postId));
  }
}
