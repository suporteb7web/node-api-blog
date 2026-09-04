export interface LikesRepository {
  like(userId: number, postId: number): Promise<void>;
  unlike(userId: number, postId: number): Promise<void>;
  countByPostId(postId: number): Promise<number>;
  countByPostIds(postIds: number[]): Promise<Map<number, number>>;
  exists(userId: number, postId: number): Promise<boolean>;
}
