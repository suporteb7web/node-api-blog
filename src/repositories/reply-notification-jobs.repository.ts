export type ReplyNotificationJobData = {
  to: string;
  postId: number;
  postTitle: string;
  replyAuthorName: string;
  replyContent: string;
};

export interface ReplyNotificationJobsRepository {
  enqueue(data: ReplyNotificationJobData): Promise<void>;
}
