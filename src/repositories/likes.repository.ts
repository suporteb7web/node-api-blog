export interface LikesRepository {
  like(userId: number, postId: number): Promise<void>;
  unlike(userId: number, postId: number): Promise<void>;
}
