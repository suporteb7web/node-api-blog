import { AppError } from '../../errors/app-error.js';
import type { UsersRepository } from '../../repositories/users.repository.js';

type GetMeInput = {
  userId: number;
};

export class GetMeUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute({ userId }: GetMeInput) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    return user;
  }
}
