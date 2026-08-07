import { count, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts, users } from '../db/schema.js';
import { AppError } from '../errors/app-error.js';
import type { CreatePostBody, UpdatePostBody } from '../schemas/posts.schemas.js';
import type { AuthUser } from '../types/auth.js';

const PAGE_LIMIT = 10;

function mapPostWithAuthor(row: {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
  authorId: number;
  authorName: string;
}) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    author: {
      id: row.authorId,
      name: row.authorName,
    },
  };
}

export async function listPosts(page: number) {
  const offset = (page - 1) * PAGE_LIMIT;

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
      .limit(PAGE_LIMIT)
      .offset(offset),
    db.select({ total: count() }).from(posts),
  ]);

  return {
    data: rows.map(mapPostWithAuthor),
    meta: {
      page,
      limit: PAGE_LIMIT,
      total,
      totalPages: Math.ceil(total / PAGE_LIMIT),
    },
  };
}

export async function getPostById(postId: number) {
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

  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Post not found');
  }

  return mapPostWithAuthor(row);
}

export async function createPost(author: AuthUser, input: CreatePostBody) {
  const [post] = await db
    .insert(posts)
    .values({
      title: input.title,
      content: input.content,
      authorId: author.id,
    })
    .returning({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      createdAt: posts.createdAt,
    });

  return {
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: {
      id: author.id,
      name: author.name,
    },
  };
}

export async function updatePost(author: AuthUser, postId: number, input: UpdatePostBody) {
  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Post not found');
  }

  if (existing.authorId !== author.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only update your own posts');
  }

  const [post] = await db
    .update(posts)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
    })
    .where(eq(posts.id, postId))
    .returning({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      createdAt: posts.createdAt,
    });

  return {
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: {
      id: author.id,
      name: author.name,
    },
  };
}

export async function deletePost(author: AuthUser, postId: number) {
  const existing = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Post not found');
  }

  if (existing.authorId !== author.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only delete your own posts');
  }

  await db.delete(posts).where(eq(posts.id, postId));
}
