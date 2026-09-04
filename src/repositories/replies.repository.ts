export type ReplyRecord = {
  id: number;
  content: string;
  createdAt: Date;
  authorId: number;
  postId: number;
};

export type CreateReplyData = {
  content: string;
  authorId: number;
  postId: number;
};

export interface RepliesRepository {
  create(data: CreateReplyData): Promise<Omit<ReplyRecord, 'authorId' | 'postId'>>;
}
