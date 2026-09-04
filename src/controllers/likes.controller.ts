import type { Request, Response } from 'express';
import { DrizzleLikesRepository } from '../repositories/drizzle-likes.repository.js';
import { DrizzlePostsRepository } from '../repositories/drizzle-posts.repository.js';
import { likePostParamsSchema } from '../schemas/likes.schemas.js';
import { LikePostUseCase } from '../use-cases/likes/like-post.js';
import { validate } from '../utils/validate.js';

const postsRepository = new DrizzlePostsRepository();
const likesRepository = new DrizzleLikesRepository();

const likePost = new LikePostUseCase(postsRepository, likesRepository);

export async function likePostController(req: Request, res: Response): Promise<void> {
  const params = validate(likePostParamsSchema, req.params);
  await likePost.execute({ user: req.user!, postId: params.id });

  res.status(204).send();
}
