import prisma from "../../../configs/database";
import { v4 as uuidv4 } from "uuid";

export const userRepository = {
	async findByEmail(email: string) {
		return await prisma.user.findUnique({
			where: { email },
			include: { profile: true },
		});
	},

	async findById(id: string) {
		return await prisma.user.findUnique({
			where: { id },
			include: { profile: true },
		});
	},

	async createWithProfile(userData: any, profileData: any) {
		return await prisma.$transaction(async (tx) => {
			const user = await tx.user.create({
				data: {
					...userData,
					profile: {
						create: profileData,
					},
				},
				include: {
					profile: true,
				},
			});

			return user;
		});
	},

	async deleteTokens(userId: string) {
		await prisma.refreshToken.deleteMany({ where: { userId } });
	},

	async createRefreshToken(userId: string, token: string) {
		return await prisma.refreshToken.create({
			data: {
				id: uuidv4(),
				userId,
				token,
			},
		});
	},
};
