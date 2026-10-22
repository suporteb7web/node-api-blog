import { AppError } from '../../errors/app-error.js';

export function assertPostVisible<T extends { premium: boolean }>(
  post: T | null,
  viewerIsPremium: boolean,
): asserts post is T {
  if (!post || (post.premium && !viewerIsPremium)) {
    throw new AppError(404, 'NOT_FOUND', 'Post not found');
  }
}
