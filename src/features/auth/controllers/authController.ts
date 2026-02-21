import { Request, Response } from "express";
import { authService } from "../services/authService";
import { HttpStatus, respons } from "../../../utils/respons";

export const authController = {
	renderLogin: (req: Request, res: Response) => {
		res.render("login", { title: "Login" });
	},

	renderRegister: (req: Request, res: Response) => {
		res.render("register", { title: "Register" });
	},

	register: async (req: Request, res: Response) => {
		try {
			const data = req.body;
			const result = await authService.register(data);

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				return res.redirect("/login?success=register");
			}

			return respons.success("Registration successful", result, HttpStatus.OK, res, req);
		} catch (error: any) {
			const statusCode = error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
			const message = error.message || "Something went wrong";

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				return res.render("register", { title: "Register", error: message, data: req.body });
			}

			return respons.error(message, null, statusCode, res, req);
		}
	},

	login: async (req: Request, res: Response) => {
		try {
			const { email, password } = req.body;
			const result = await authService.login(email, password);

			// Store tokens in cookies for EJS/MVC
			res.cookie("accessToken", result.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production" });
			res.cookie("refreshToken", result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production" });

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				return res.redirect("/");
			}

			return respons.success("Login successful", result, HttpStatus.OK, res, req);
		} catch (error: any) {
			const statusCode = error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
			const message = error.message || "Something went wrong";

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				return res.render("login", { title: "Login", error: message, email: req.body.email });
			}

			return respons.error(message, null, statusCode, res, req);
		}
	},

	logout: async (req: Request, res: Response) => {
		try {
			if (req.user) {
				await authService.logout(req.user.id);
			}
			res.clearCookie("accessToken");
			res.clearCookie("refreshToken");

			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				return res.redirect("/login");
			}

			return respons.success("Logout successful", null, HttpStatus.OK, res, req);
		} catch (error: any) {
			return res.redirect("/login");
		}
	}
};
