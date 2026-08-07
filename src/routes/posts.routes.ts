import { Router } from 'express';
import {
  createPostController,
  deletePostController,
  getPostController,
  listPostsController,
  updatePostController,
} from '../controllers/posts.controller.js';
import { requireAuth } from '../middlewares/auth.js';

export const postsRouter = Router();

postsRouter.get('/api/posts', listPostsController);
postsRouter.get('/api/posts/:id', getPostController);
postsRouter.post('/api/posts', requireAuth, createPostController);
postsRouter.put('/api/posts/:id', requireAuth, updatePostController);
postsRouter.delete('/api/posts/:id', requireAuth, deletePostController);
