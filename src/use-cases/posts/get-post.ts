import { AppError } from "../../errors/app-error.js";
import { PostsRepository } from "../../repositories/posts.repository.js";

type GetPostInput = {
    postId: number;
}

export class GetPostUseCase {
    constructor(private readonly postsRepository: PostsRepository) { }

    async execute({ postId }: GetPostInput) {
        const row = await this.postsRepository.findWithAuthorById(postId);

        if (!row) {
            throw new AppError(404, "NOT_FOUND", "Post not found");
        }

        return row;
    }
}
