export type UserRecord = {
  id: number;
  name: string;
  email: string;
  password: string;
  token: string | null;
};

export type CreateUserData = {
  name: string;
  email: string;
  password: string;
  token: string;
};

export type UserPublic = {
  id: number;
  name: string;
  email: string;
};

export interface UsersRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  create(data: CreateUserData): Promise<UserPublic>;
  updateToken(userId: number, token: string): Promise<void>;
}
