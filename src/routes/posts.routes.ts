import { Router } from 'express';
import { likePostController, unlikePostController } from '../controllers/likes.controller.js';
import {
  createPostController,
  deletePostController,
  getPostController,
  listPostsController,
  updatePostController,
} from '../controllers/posts.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.js';

export const postsRouter = Router();

postsRouter.get('/api/posts', listPostsController);
postsRouter.get('/api/posts/:id', optionalAuth, getPostController);
postsRouter.post('/api/posts', requireAuth, createPostController);
postsRouter.put('/api/posts/:id', requireAuth, updatePostController);
postsRouter.delete('/api/posts/:id', requireAuth, deletePostController);
postsRouter.post('/api/posts/:id/likes', requireAuth, likePostController);
postsRouter.delete('/api/posts/:id/likes', requireAuth, unlikePostController);
