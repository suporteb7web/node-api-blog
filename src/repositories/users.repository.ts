export type UserPublic = {
  id: number;
  name: string;
  email: string;
  avatarPath: string | null;
  premium: boolean;
};

export type UserRecord = UserPublic & {
  password: string;
  token: string | null;
};

export type CreateUserData = {
  name: string;
  email: string;
  password: string;
  token: string;
};

export interface UsersRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: number): Promise<UserPublic | null>;
  create(data: CreateUserData): Promise<UserPublic>;
  updateToken(userId: number, token: string): Promise<void>;
  updateAvatarPath(userId: number, avatarPath: string): Promise<void>;
  markPremium(userId: number): Promise<void>;
}
