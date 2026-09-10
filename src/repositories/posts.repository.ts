export type PostRecord = {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
  authorId: number;
  photoPath: string | null;
};

export type PostWithAuthorRow = {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
  authorId: number;
  authorName: string;
  photoPath: string | null;
};

export type CreatePostData = {
  title: string;
  content: string;
  authorId: number;
};

export type UpdatePostData = {
  title?: string;
  content?: string;
};

export type ListWithAuthorResult = {
  rows: PostWithAuthorRow[];
  total: number;
};

export interface PostsRepository {
  listWithAuthor(page: number, limit: number): Promise<ListWithAuthorResult>;
  findWithAuthorById(postId: number): Promise<PostWithAuthorRow | null>;
  create(data: CreatePostData): Promise<Omit<PostRecord, 'authorId'>>;
  findById(postId: number): Promise<PostRecord | null>;
  update(postId: number, data: UpdatePostData): Promise<Omit<PostRecord, 'authorId'>>;
  updatePhotoPath(postId: number, photoPath: string): Promise<void>;
  delete(postId: number): Promise<void>;
}
