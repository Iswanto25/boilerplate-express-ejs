import prisma from "../../../configs/database";
import { existingEmail } from "../../../utils/existingUsers";
import { encryptPassword, comparePassword, isEmailValid } from "../../../utils/utils";
import { getFile, uploadBase64 } from "../../../utils/s3";
import { apiError } from "../../../utils/respons";
import { jwtUtils } from "../../../utils/jwt";
import { storeToken, deleteToken } from "../../../utils/tokenStore";
import { v4 as uuidv4 } from "uuid";

const folder = "profile";

export const authService = {
	async register(data: any) {
		return await prisma.$transaction(async (tx) => {
			if (!isEmailValid(data.email)) throw new apiError(400, "Invalid email");
			const existing = await existingEmail(data.email);
			if (existing) throw new apiError(400, "Email already exists");

			let photoFileName: string | null = null;
			if (data.photo) {
				const uploadResult = await uploadBase64(folder, data.photo, 5, ["image/jpeg", "image/png", "image/jpg", "image/webp"]);
				photoFileName = uploadResult.fileName;
			}

			const user = await tx.user.create({
				data: {
					email: data.email,
					password: await encryptPassword(data.password),
					profile: {
						create: {
							name: data.name,
							address: data.address,
							phone: data.phone,
							photo: photoFileName,
						},
					},
				},
				include: {
					profile: true,
				},
			});

			const accessToken = jwtUtils.generateAccessToken({ id: user.id, email: user.email });
			const refreshToken = jwtUtils.generateRefreshToken({ id: user.id, email: user.email });

			await storeToken(user.id, accessToken, "access", 24 * 60 * 60);
			await storeToken(user.id, refreshToken, "refresh", 7 * 24 * 60 * 60);

			await tx.refreshToken.create({
				data: {
					id: uuidv4(),
					userId: user.id,
					token: refreshToken,
				},
			});

			return {
				user: {
					id: user.id,
					name: user.profile?.name || null,
					email: user.email,
				},
				accessToken,
				refreshToken,
			};
		});
	},

	async login(email: string, password: string) {
		if (!isEmailValid(email)) throw new apiError(400, "Invalid email");
		const user = await prisma.user.findUnique({
			where: { email },
			include: { profile: true },
		});
		if (!user) throw new apiError(400, "User not found");

		const isValid = await comparePassword(password, user.password!);
		if (!isValid) throw new apiError(400, "Invalid password");

		await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
		await deleteToken(user.id, "access");
		await deleteToken(user.id, "refresh");

		const accessToken = jwtUtils.generateAccessToken({ id: user.id, email: user.email });
		const refreshToken = jwtUtils.generateRefreshToken({ id: user.id, email: user.email });

		await prisma.refreshToken.create({
			data: {
				id: uuidv4(),
				userId: user.id,
				token: refreshToken,
			},
		});

		await storeToken(user.id, accessToken, "access", 24 * 60 * 60);
		await storeToken(user.id, refreshToken, "refresh", 7 * 24 * 60 * 60);

		const photoUrl = user.profile?.photo ? await getFile(folder, user.profile.photo) : null;

		return {
			user: {
				id: user.id,
				name: user.profile?.name || null,
				email: user.email,
				photo: photoUrl,
			},
			accessToken,
			refreshToken,
		};
	},

	async logout(userId: string) {
		await prisma.refreshToken.deleteMany({ where: { userId } });
		await deleteToken(userId, "access");
		await deleteToken(userId, "refresh");
	}
};
