import bcrypt from "bcrypt";
import { AppError } from "../../errors/app-error.js";
import { UsersRepository } from "../../repositories/users.repository.js";
import { RegisterBody } from "../../schemas/auth.schemas.js";
import { generateSessionToken } from "../../utils/generate-session-token.js";

type RegisterInput = {
    data: RegisterBody;
}

export class RegisterUseCase {
    constructor(private readonly usersRepository: UsersRepository) { }

    async execute({ data }: RegisterInput) {
        const existing = await this.usersRepository.findByEmail(data.email);

        if (existing) {
            throw new AppError(409, "CONFLICT", "Email already registered");
        }

        const passwordHash = await bcrypt.hash(data.password, 10);
        const token = generateSessionToken();

        const user = await this.usersRepository.create({
            name: data.name,
            email: data.email,
            password: passwordHash,
            token,
        });

        return { token, user };
    }
}
