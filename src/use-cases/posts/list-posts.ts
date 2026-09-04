import { PostsRepository } from "../../repositories/posts.repository.js";
import { LikesRepository } from "../../repositories/likes.repository.js";

const PAGE_LIMIT = 10;

type ListPostsInput = {
    page: number;
}

export class ListPostsUseCase {
    constructor(
        private readonly postsRepository: PostsRepository,
        private readonly likesRepository: LikesRepository,
    ) { }

    async execute({ page }: ListPostsInput) {
        const { rows, total } = await this.postsRepository.listWithAuthor(page, PAGE_LIMIT);
        const likesCounts = await this.likesRepository.countByPostIds(rows.map((row) => row.id));

        return {
            rows: rows.map((row) => ({
                ...row,
                likesCount: likesCounts.get(row.id) ?? 0,
            })),
            total,
            page,
            limit: PAGE_LIMIT,
        };
    }
}
