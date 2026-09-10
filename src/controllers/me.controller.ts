import type { Request, Response } from 'express';
import { toUserResponseDto } from '../dtos/users/user-response.dto.js';
import { DrizzleUsersRepository } from '../repositories/drizzle-users.repository.js';
import { SharpImageStorage } from '../storage/sharp-image-storage.js';
import { GetMeUseCase } from '../use-cases/users/get-me.js';
import { UpdateAvatarUseCase } from '../use-cases/users/update-avatar.js';

const usersRepository = new DrizzleUsersRepository();
const imageStorage = new SharpImageStorage();

const getMe = new GetMeUseCase(usersRepository);
const updateAvatar = new UpdateAvatarUseCase(usersRepository, imageStorage);

export async function getMeController(req: Request, res: Response): Promise<void> {
  const user = await getMe.execute({ userId: req.user!.id });

  res.status(200).json(toUserResponseDto(user));
}

export async function updateAvatarController(req: Request, res: Response): Promise<void> {
  const user = await updateAvatar.execute({
    userId: req.user!.id,
    buffer: req.file?.buffer,
  });

  res.status(200).json(toUserResponseDto(user));
}
