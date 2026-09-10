import { AppError } from "../../errors/app-error.js";
import { PostsRepository } from "../../repositories/posts.repository.js";
import { ImageStorage } from "../../storage/image-storage.js";
import { AuthUser } from "../../types/auth.js";

type DeletePostInput = {
    author: AuthUser;
    postId: number;
}

export class DeletePostUseCase {
    constructor(
        private readonly postsRepository: PostsRepository,
        private readonly imageStorage: ImageStorage,
    ) { }

    async execute({ author, postId }: DeletePostInput) {
        const existing = await this.postsRepository.findById(postId);
        if (!existing) throw new AppError(404, "NOT_FOUND", "Post not found");

        if (existing.authorId !== author.id) {
            throw new AppError(403, "FORBIDDEN", "You can only delete your own posts");
        }

        await this.postsRepository.delete(postId);

        if (existing.photoPath) {
            await this.imageStorage.delete(existing.photoPath);
        }
    }
}
