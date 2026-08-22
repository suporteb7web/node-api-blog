import bcrypt from "bcrypt";
import { AppError } from "../../errors/app-error.js";
import { UsersRepository } from "../../repositories/users.repository.js";
import { LoginBody } from "../../schemas/auth.schemas.js";
import { generateSessionToken } from "../../utils/generate-session-token.js";

type LoginInput = {
    data: LoginBody;
}

export class LoginUseCase {
    constructor(private readonly usersRepository: UsersRepository) { }

    async execute({ data }: LoginInput) {
        const user = await this.usersRepository.findByEmail(data.email);

        if (!user) {
            throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
        }

        const passwordMatches = await bcrypt.compare(data.password, user.password);

        if (!passwordMatches) {
            throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
        }

        const token = generateSessionToken();

        await this.usersRepository.updateToken(user.id, token);

        return { token, user };
    }
}
