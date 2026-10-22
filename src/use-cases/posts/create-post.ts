import { AppError } from "../../errors/app-error.js";
import { PostsRepository } from "../../repositories/posts.repository.js";
import { CreatePostBody } from "../../schemas/posts.schemas.js";
import { AuthUser } from "../../types/auth.js";

type CreatePostInput = {
    author: AuthUser;
    data: CreatePostBody;
}

export class CreatePostUseCase {
    constructor(private readonly postsRepository: PostsRepository) { }

    async execute({ author, data }: CreatePostInput) {
        if (data.premium === true && !author.premium) {
            throw new AppError(403, "FORBIDDEN", "Only premium users can mark posts as premium");
        }

        return this.postsRepository.create({
            title: data.title,
            content: data.content,
            authorId: author.id,
            premium: data.premium ?? false,
        })
    }
}