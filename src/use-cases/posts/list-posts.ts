import { PostsRepository } from "../../repositories/posts.repository.js";

const PAGE_LIMIT = 10;

type ListPostsInput = {
    page: number;
}

export class ListPostsUseCase {
    constructor(private readonly postsRepository: PostsRepository) { }

    async execute({ page }: ListPostsInput) {
        const { rows, total } = await this.postsRepository.listWithAuthor(page, PAGE_LIMIT);

        return {
            rows,
            total,
            page,
            limit: PAGE_LIMIT,
        };
    }
}
