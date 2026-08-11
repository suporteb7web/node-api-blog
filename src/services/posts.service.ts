import { AppError } from '../errors/app-error.js';
import type { PostsRepository } from '../repositories/posts.repository.js';
import type { CreatePostBody, UpdatePostBody } from '../schemas/posts.schemas.js';
import type { AuthUser } from '../types/auth.js';

const PAGE_LIMIT = 10;

export class PostsService {
  constructor(private readonly postsRepository: PostsRepository) { }

  async listPosts(page: number) {
    const { rows, total } = await this.postsRepository.listWithAuthor(page, PAGE_LIMIT);

    return {
      rows,
      total,
      page,
      limit: PAGE_LIMIT,
    };
  }

  async getPostById(postId: number) {
    const row = await this.postsRepository.findWithAuthorById(postId);

    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Post not found');
    }

    return row;
  }

  async createPost(author: AuthUser, input: CreatePostBody) {
    return this.postsRepository.create({
      title: input.title,
      content: input.content,
      authorId: author.id,
    });
  }

  async updatePost(author: AuthUser, postId: number, input: UpdatePostBody) {
    const existing = await this.postsRepository.findById(postId);
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Post not found');

    if (existing.authorId !== author.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only update your own posts');
    }

    return this.postsRepository.update(postId, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
    });
  }

  async deletePost(author: AuthUser, postId: number) {
    const existing = await this.postsRepository.findById(postId);
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Post not found');

    if (existing.authorId !== author.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only delete your own posts');
    }

    await this.postsRepository.delete(postId);
  }
}
