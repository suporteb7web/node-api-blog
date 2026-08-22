type PostLike = {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
};

type AuthorLike = {
  id: number;
  name: string;
};

type PostWithAuthorLike = PostLike & {
  authorId: number;
  authorName: string;
};

export type PostResponseDto = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  author: {
    id: number;
    name: string;
  };
};

export type ListPostsResponseDto = {
  data: PostResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function toPostResponseDto(post: PostLike, author: AuthorLike): PostResponseDto {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: { id: author.id, name: author.name },
  };
}

export function toListPostsResponseDto(
  rows: PostWithAuthorLike[],
  meta: { page: number; limit: number; total: number },
): ListPostsResponseDto {
  return {
    data: rows.map((row) => toPostResponseDto(row, { id: row.authorId, name: row.authorName })),
    meta: {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  };
}
