import { AppError } from "../../errors/app-error.js";
import { PostsRepository } from "../../repositories/posts.repository.js";
import { UpdatePostBody } from "../../schemas/posts.schemas.js";
import { AuthUser } from "../../types/auth.js";

type UpdatePostInput = {
    author: AuthUser;
    postId: number;
    data: UpdatePostBody;
}

export class UpdatePostUseCase {
    constructor(private readonly postsRepository: PostsRepository) { }

    async execute({ author, postId, data }: UpdatePostInput) {
        const existing = await this.postsRepository.findById(postId);
        if (!existing) throw new AppError(404, "NOT_FOUND", "Post not found");

        if (existing.authorId !== author.id) {
            throw new AppError(403, "FORBIDDEN", "You can only update your own posts");
        }

        return this.postsRepository.update(postId, {
            ...(data.title !== undefined ? { title: data.title } : {}),
            ...(data.content !== undefined ? { content: data.content } : {}),
        });
    }
}
