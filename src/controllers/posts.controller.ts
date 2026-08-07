import type { Request, Response } from 'express';
import {
  createPostBodySchema,
  listPostsQuerySchema,
  postIdParamsSchema,
  updatePostBodySchema,
} from '../schemas/posts.schemas.js';
import * as postsService from '../services/posts.service.js';
import { validate } from '../utils/validate.js';

export async function listPostsController(req: Request, res: Response): Promise<void> {
  const query = validate(listPostsQuerySchema, req.query);
  const result = await postsService.listPosts(query.page);

  res.status(200).json(result);
}

export async function getPostController(req: Request, res: Response): Promise<void> {
  const params = validate(postIdParamsSchema, req.params);
  const result = await postsService.getPostById(params.id);

  res.status(200).json(result);
}

export async function createPostController(req: Request, res: Response): Promise<void> {
  const body = validate(createPostBodySchema, req.body);
  const result = await postsService.createPost(req.user!, body);

  res.status(201).json(result);
}

export async function updatePostController(req: Request, res: Response): Promise<void> {
  const params = validate(postIdParamsSchema, req.params);
  const body = validate(updatePostBodySchema, req.body);
  const result = await postsService.updatePost(req.user!, params.id, body);

  res.status(200).json(result);
}

export async function deletePostController(req: Request, res: Response): Promise<void> {
  const params = validate(postIdParamsSchema, req.params);
  await postsService.deletePost(req.user!, params.id);

  res.status(204).send();
}
