import { toUserResponseDto, type UserResponseDto } from '../users/user-response.dto.js';

type UserLike = {
  id: number;
  name: string;
  email: string;
  avatarPath?: string | null;
};

export type AuthResponseDto = {
  token: string;
  user: UserResponseDto;
};

export function toAuthResponseDto(token: string, user: UserLike): AuthResponseDto {
  return {
    token,
    user: toUserResponseDto(user),
  };
}
