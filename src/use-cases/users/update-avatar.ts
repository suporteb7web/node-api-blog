import { AppError } from '../../errors/app-error.js';
import type { UsersRepository } from '../../repositories/users.repository.js';
import type { ImageStorage } from '../../storage/image-storage.js';

type UpdateAvatarInput = {
  userId: number;
  buffer?: Buffer;
};

export class UpdateAvatarUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly imageStorage: ImageStorage,
  ) {}

  async execute({ userId, buffer }: UpdateAvatarInput) {
    if (!buffer) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Image file is required', [
        { path: 'image', message: 'Image file is required' },
      ]);
    }

    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    let avatarPath: string;

    try {
      avatarPath = await this.imageStorage.saveAvatar(buffer);
    } catch {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid image', [
        { path: 'image', message: 'Invalid image' },
      ]);
    }

    await this.usersRepository.updateAvatarPath(userId, avatarPath);

    if (user.avatarPath) {
      await this.imageStorage.delete(user.avatarPath);
    }

    return { ...user, avatarPath };
  }
}
