import { toPublicUploadPath } from '../media-path.js';

type UserLike = {
  id: number;
  name: string;
  email: string;
  avatarPath?: string | null;
};

export type UserResponseDto = {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
};

export type MeResponseDto = UserResponseDto & {
  premium: boolean;
};

export function toUserResponseDto(user: UserLike): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: toPublicUploadPath(user.avatarPath),
  };
}

export function toMeResponseDto(user: UserLike & { premium: boolean }): MeResponseDto {
  return {
    ...toUserResponseDto(user),
    premium: user.premium,
  };
}
