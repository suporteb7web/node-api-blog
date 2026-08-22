type UserLike = {
  id: number;
  name: string;
  email: string;
};

export type AuthResponseDto = {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
};

export function toAuthResponseDto(token: string, user: UserLike): AuthResponseDto {
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  };
}
