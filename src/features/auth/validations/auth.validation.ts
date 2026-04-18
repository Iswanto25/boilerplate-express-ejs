import { z } from "zod";

export const authValidation = {
	register: z.object({
		name: z.string().min(3, "Nama minimal 3 karakter"),
		email: z.string().email("Format email tidak valid"),
		password: z.string().min(8, "Password minimal 8 karakter"),
		phone: z.string().optional(),
		address: z.string().optional(),
		photo: z.string().optional(),
	}),

	login: z.object({
		email: z.string().email("Format email tidak valid"),
		password: z.string().min(1, "Password wajib diisi"),
	}),
};
