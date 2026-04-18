import prisma from "@/configs/database.js";
import { v4 as uuidv4 } from "uuid";

export const authRepository = {
	transaction: async (callback: (tx: any) => Promise<any>) => {
		return await prisma.$transaction(callback);
	},

	async findByEmail(email: string, tx: any = prisma) {
		return await tx.user.findUnique({
			where: { email },
			include: { profile: true },
		});
	},

	async findById(id: string, tx: any = prisma) {
		return await tx.user.findUnique({
			where: { id },
			include: { profile: true },
		});
	},

	async createWithProfile(userData: any, profileData: any, tx: any = prisma) {
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
	},

	async deleteTokens(userId: string, tx: any = prisma) {
		await tx.refreshToken.deleteMany({ where: { userId } });
	},

	async createRefreshToken(userId: string, token: string, tx: any = prisma) {
		return await tx.refreshToken.create({
			data: {
				id: uuidv4(),
				userId,
				token,
			},
		});
	},
};
