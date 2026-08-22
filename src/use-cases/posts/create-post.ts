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
        return this.postsRepository.create({
            title: data.title,
            content: data.content,
            authorId: author.id
        })
    }
}