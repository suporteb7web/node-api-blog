import type { Request, Response } from 'express';
import type { PostWithAuthorRow } from '../repositories/posts.repository.js';
import { DrizzlePostsRepository } from '../repositories/drizzle-posts.repository.js';
import {
  createPostBodySchema,
  listPostsQuerySchema,
  postIdParamsSchema,
  updatePostBodySchema,
} from '../schemas/posts.schemas.js';
import { PostsService } from '../services/posts.service.js';
import { validate } from '../utils/validate.js';

const postsService = new PostsService(new DrizzlePostsRepository());

function toPostWithAuthorResponse(row: PostWithAuthorRow) {
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

export async function listPostsController(req: Request, res: Response): Promise<void> {
  const query = validate(listPostsQuerySchema, req.query);
  const { rows, total, page, limit } = await postsService.listPosts(query.page);

  res.status(200).json({
    data: rows.map(toPostWithAuthorResponse),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getPostController(req: Request, res: Response): Promise<void> {
  const params = validate(postIdParamsSchema, req.params);
  const post = await postsService.getPostById(params.id);

  res.status(200).json(toPostWithAuthorResponse(post));
}

export async function createPostController(req: Request, res: Response): Promise<void> {
  const body = validate(createPostBodySchema, req.body);
  const post = await postsService.createPost(req.user!, body);

  res.status(201).json({
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: {
      id: req.user?.id,
      name: req.user?.name,
    },
  });
}

export async function updatePostController(req: Request, res: Response): Promise<void> {
  const params = validate(postIdParamsSchema, req.params);
  const body = validate(updatePostBodySchema, req.body);
  const post = await postsService.updatePost(req.user!, params.id, body);

  res.status(200).json({
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: {
      id: req.user?.id,
      name: req.user?.name,
    },
  });
}

export async function deletePostController(req: Request, res: Response): Promise<void> {
  const params = validate(postIdParamsSchema, req.params);
  await postsService.deletePost(req.user!, params.id);

  res.status(204).send();
}
