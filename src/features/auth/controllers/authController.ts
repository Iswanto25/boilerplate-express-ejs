import { Request, Response } from "express";
import { authService } from "../services/authService";
import { HttpStatus, respons } from "../../../utils/respons";
import { registerSchema, loginSchema } from "../schemas/authSchema";
import { ZodError } from "zod";

export const authController = {
	renderLogin: (req: Request, res: Response) => {
		res.render("login", { title: "Login", email: "" });
	},

	renderRegister: (req: Request, res: Response) => {
		res.render("register", { title: "Register", data: {} });
	},

	register: async (req: Request, res: Response) => {
		try {
			// Zod Validation
			const validatedData = registerSchema.parse(req.body);

			const result = await authService.register(validatedData);

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				req.flash("success", "Registrasi berhasil! Silakan login.");
				return res.redirect("/login");
			}

			return respons.success("Registration successful", result, HttpStatus.OK, res, req);
		} catch (error: any) {
			let message = "Something went wrong";

			if (error instanceof ZodError) {
				message = error.errors[0].message;
			} else {
				message = error.message || message;
			}

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				req.flash("error", message);
				return res.render("register", { title: "Register", data: req.body });
			}

			return respons.error(message, null, HttpStatus.BAD_REQUEST, res, req);
		}
	},

	login: async (req: Request, res: Response) => {
		try {
			// Zod Validation
			const validatedData = loginSchema.parse(req.body);

			const result = await authService.login(validatedData.email, validatedData.password);

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
			let message = "Something went wrong";

			if (error instanceof ZodError) {
				message = error.errors[0].message;
			} else {
				message = error.message || message;
			}

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				req.flash("error", message);
				return res.render("login", { title: "Login", email: req.body.email });
			}

			return respons.error(message, null, HttpStatus.BAD_REQUEST, res, req);
		}
	},

	logout: async (req: Request, res: Response) => {
		try {
			if (req.user) {
				await authService.logout(req.user.id);
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
