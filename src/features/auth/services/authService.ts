import { userRepository } from "../repositories/userRepository";
import { encryptPassword, comparePassword, isEmailValid } from "../../../utils/utils";
import { getFile, uploadBase64 } from "../../../utils/s3";
import { apiError } from "../../../utils/respons";
import { jwtUtils } from "../../../utils/jwt";
import { storeToken, deleteToken } from "../../../utils/tokenStore";

const folder = "profile";

export const authService = {
	async register(data: any) {
		if (!isEmailValid(data.email)) throw new apiError(400, "Invalid email");

		const existing = await userRepository.findByEmail(data.email);
		if (existing) throw new apiError(400, "Email already exists");

		let photoFileName: string | null = null;
		if (data.photo) {
			const uploadResult = await uploadBase64(folder, data.photo, 5, ["image/jpeg", "image/png", "image/jpg", "image/webp"]);
			photoFileName = uploadResult.fileName;
		}

		const user = await userRepository.createWithProfile(
			{
				email: data.email,
				password: await encryptPassword(data.password),
			},
			{
				name: data.name,
				address: data.address,
				phone: data.phone,
				photo: photoFileName,
			},
		);

		const accessToken = jwtUtils.generateAccessToken({ id: user.id, email: user.email });
		const refreshToken = jwtUtils.generateRefreshToken({ id: user.id, email: user.email });

		await storeToken(user.id, accessToken, "access", 24 * 60 * 60);
		await storeToken(user.id, refreshToken, "refresh", 7 * 24 * 60 * 60);

		await userRepository.createRefreshToken(user.id, refreshToken);

		return {
			user: {
				id: user.id,
				name: user.profile?.name || null,
				email: user.email,
			},
			accessToken,
			refreshToken,
		};
	},

	async login(email: string, password: string) {
		if (!isEmailValid(email)) throw new apiError(400, "Invalid email");

		const user = await userRepository.findByEmail(email);
		if (!user) throw new apiError(400, "User not found");

		const isValid = await comparePassword(password, user.password!);
		if (!isValid) throw new apiError(400, "Invalid password");

		// Clean up existing tokens
		await userRepository.deleteTokens(user.id);
		await deleteToken(user.id, "access");
		await deleteToken(user.id, "refresh");

		const accessToken = jwtUtils.generateAccessToken({ id: user.id, email: user.email });
		const refreshToken = jwtUtils.generateRefreshToken({ id: user.id, email: user.email });

		await userRepository.createRefreshToken(user.id, refreshToken);
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
		await userRepository.deleteTokens(userId);
		await deleteToken(userId, "access");
		await deleteToken(userId, "refresh");
	},
};
