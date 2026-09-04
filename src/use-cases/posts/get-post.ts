import { AppError } from "../../errors/app-error.js";
import { LikesRepository } from "../../repositories/likes.repository.js";
import { PostsRepository } from "../../repositories/posts.repository.js";

type GetPostInput = {
    postId: number;
    userId?: number;
}

export class GetPostUseCase {
    constructor(
        private readonly postsRepository: PostsRepository,
        private readonly likesRepository: LikesRepository,
    ) { }

    async execute({ postId, userId }: GetPostInput) {
        const row = await this.postsRepository.findWithAuthorById(postId);

        if (!row) {
            throw new AppError(404, "NOT_FOUND", "Post not found");
        }

        const [likesCount, likedByMe] = await Promise.all([
            this.likesRepository.countByPostId(postId),
            userId ? this.likesRepository.exists(userId, postId) : Promise.resolve(false),
        ]);

        return { ...row, likesCount, likedByMe };
    }
}
