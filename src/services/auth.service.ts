import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import type { UsersRepository } from '../repositories/users.repository.js';
import type { LoginBody, RegisterBody } from '../schemas/auth.schemas.js';

function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async register(input: RegisterBody) {
    const existing = await this.usersRepository.findByEmail(input.email);

    if (existing) {
      throw new AppError(409, 'CONFLICT', 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const token = generateSessionToken();

    const user = await this.usersRepository.create({
      name: input.name,
      email: input.email,
      password: passwordHash,
      token,
    });

    return { token, user };
  }

  async login(input: LoginBody) {
    const user = await this.usersRepository.findByEmail(input.email);

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(input.password, user.password);

    if (!passwordMatches) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }

    const token = generateSessionToken();

    await this.usersRepository.updateToken(user.id, token);

    return { token, user };
  }
}
