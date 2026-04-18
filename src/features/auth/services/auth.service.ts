import { authRepository } from "@/features/auth/repositories/auth.repository.js";
import { encryptPassword, comparePassword, isEmailValid } from "@/utils/utils.js";
import { getFile, uploadBase64 } from "@/utils/s3.js";
import { apiError } from "@/utils/respons.js";
import { jwtUtils } from "@/utils/jwt.js";
import { storeToken, deleteToken } from "@/utils/tokenStore.js";
import { RegisterInput } from "@/features/auth/types/auth.types.js";

const folder = "profile";

export const authServices = {
	async register(data: RegisterInput) {
		return await authRepository.transaction(async (tx: any) => {
			if (!isEmailValid(data.email)) throw new apiError(400, "Invalid email");

			const existing = await authRepository.findByEmail(data.email, tx);
			if (existing) throw new apiError(400, "Email already exists");

			let photoFileName: string | null = null;
			if (data.photo) {
				const uploadResult = await uploadBase64(folder, data.photo, 5, ["image/jpeg", "image/png", "image/jpg", "image/webp"]);
				photoFileName = uploadResult.fileName;
			}

			const hashedPassword = await encryptPassword(data.password);

			const user = await authRepository.createWithProfile(
				{
					email: data.email,
					password: hashedPassword,
				},
				{
					name: data.name,
					address: data.address,
					phone: data.phone,
					photo: photoFileName,
				},
				tx,
			);

			const accessToken = jwtUtils.generateAccessToken({ id: user.id, email: user.email });
			const refreshToken = jwtUtils.generateRefreshToken({ id: user.id, email: user.email });

			await Promise.all([
				storeToken(user.id, accessToken, "access", 24 * 60 * 60),
				storeToken(user.id, refreshToken, "refresh", 7 * 24 * 60 * 60),
				authRepository.createRefreshToken(user.id, refreshToken, tx),
			]);

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

		const user = await authRepository.findByEmail(email);
		if (!user) throw new apiError(400, "User not found");

		const isValid = await comparePassword(password, user.password!);
		if (!isValid) throw new apiError(400, "Invalid password");

		// Clean up existing tokens
		await Promise.all([authRepository.deleteTokens(user.id), deleteToken(user.id, "access"), deleteToken(user.id, "refresh")]);

		const accessToken = jwtUtils.generateAccessToken({ id: user.id, email: user.email });
		const refreshToken = jwtUtils.generateRefreshToken({ id: user.id, email: user.email });

		await Promise.all([
			authRepository.createRefreshToken(user.id, refreshToken),
			storeToken(user.id, accessToken, "access", 24 * 60 * 60),
			storeToken(user.id, refreshToken, "refresh", 7 * 24 * 60 * 60),
		]);

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
		await Promise.all([authRepository.deleteTokens(userId), deleteToken(userId, "access"), deleteToken(userId, "refresh")]);
	},
};
