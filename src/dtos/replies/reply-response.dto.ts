type ReplyLike = {
  id: number;
  content: string;
  createdAt: Date;
};

type AuthorLike = {
  id: number;
  name: string;
};

export type ReplyResponseDto = {
  id: number;
  content: string;
  createdAt: string;
  author: {
    id: number;
    name: string;
  };
};

export function toReplyResponseDto(reply: ReplyLike, author: AuthorLike): ReplyResponseDto {
  return {
    id: reply.id,
    content: reply.content,
    createdAt: reply.createdAt.toISOString(),
    author: { id: author.id, name: author.name },
  };
}
