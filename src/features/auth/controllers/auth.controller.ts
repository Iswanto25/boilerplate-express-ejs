import { Request, Response } from "express";
import { authServices } from "@/features/auth/services/auth.service.js";
import { HttpStatus, respons } from "@/utils/respons.js";
import { authValidation } from "@/features/auth/validations/auth.validation.js";

export const authController = {
	renderLogin: (req: Request, res: Response) => {
		res.render("login", { title: "Login", email: "" });
	},

	renderRegister: (req: Request, res: Response) => {
		res.render("register", { title: "Register", data: {} });
	},

	register: async (req: Request, res: Response) => {
		try {
			const validation = authValidation.register.safeParse(req.body);

			if (!validation.success) {
				const errorMsg = validation.error.issues[0]?.message || "Data tidak valid";
				if (req.accepts("html") && !req.path.startsWith("/api/")) {
					req.flash("error", errorMsg);
					return res.render("register", { title: "Register", data: req.body });
				}
				return respons.error(errorMsg, errorMsg, HttpStatus.BAD_REQUEST, res, req);
			}

			const result = await authServices.register(validation.data);

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				req.flash("success", "Registrasi berhasil! Silakan login.");
				return res.redirect("/login");
			}

			return respons.success("Registration successful", result, HttpStatus.OK, res, req);
		} catch (error: any) {
			const err = error as { statusCode?: number; message?: string };
			const statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
			const message = err.message || "Something went wrong";

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				req.flash("error", message);
				return res.render("register", { title: "Register", data: req.body });
			}

			return respons.error(message, message, statusCode, res, req);
		}
	},

	login: async (req: Request, res: Response) => {
		try {
			const validation = authValidation.login.safeParse(req.body);

			if (!validation.success) {
				const errorMsg = validation.error.issues[0]?.message || "Data tidak valid";
				if (req.accepts("html") && !req.path.startsWith("/api/")) {
					req.flash("error", errorMsg);
					return res.render("login", { title: "Login", email: req.body.email });
				}
				return respons.error(errorMsg, errorMsg, HttpStatus.BAD_REQUEST, res, req);
			}

			const result = await authServices.login(validation.data.email, validation.data.password);

			// Store tokens in cookies
			res.cookie("accessToken", result.accessToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
			});
			res.cookie("refreshToken", result.refreshToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
			});

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				req.flash("success", `Selamat datang kembali, ${result.user.name}!`);
				return res.redirect("/");
			}

			return respons.success("Login successful", result, HttpStatus.OK, res, req);
		} catch (error: any) {
			const err = error as { statusCode?: number; message?: string };
			const statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
			const message = err.message || "Something went wrong";

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				req.flash("error", message);
				return res.render("login", { title: "Login", email: req.body.email });
			}

			return respons.error(message, message, statusCode, res, req);
		}
	},

	logout: async (req: Request, res: Response) => {
		try {
			if (req.user) {
				await authServices.logout(req.user.id);
			}
			res.clearCookie("accessToken");
			res.clearCookie("refreshToken");

			req.session.destroy(() => {
				if (req.accepts("html") && !req.path.startsWith("/api/")) {
					return res.redirect("/login");
				}
				return respons.success("Logout successful", null, HttpStatus.OK, res, req);
			});
		} catch (error: any) {
			return res.redirect("/login");
		}
	},
};
