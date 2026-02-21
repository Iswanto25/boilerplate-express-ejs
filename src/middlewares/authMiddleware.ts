import { Request, Response, NextFunction } from "express";
import { jwtUtils } from "../utils/jwt";
import { respons, HttpStatus } from "../utils/respons";
import { getStoredToken } from "../utils/tokenStore";
import prisma from "../configs/database";

export const authenticate = {
	async checkToken(req: Request): Promise<{ valid: boolean; userId?: string }> {
		const authHeader = req.headers.authorization;
		let token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

		// Support for cookies (common in EJS apps)
		if (!token && (req as any).cookies?.accessToken) {
			token = (req as any).cookies.accessToken;
		}

		if (!token) {
			return { valid: false };
		}

		try {
			const decoded = jwtUtils.verifyAccessToken(token);
			const storedToken = await getStoredToken(decoded.id, "access");
			if (storedToken !== token) return { valid: false };
			return { valid: true, userId: decoded.id };
		} catch {
			return { valid: false };
		}
	},

	async verifyToken(req: Request, res: Response, next: NextFunction) {
		const result = await authenticate.checkToken(req);
		if (!result.valid || !result.userId) {
			// If it's a web request (expects HTML), redirect to login
			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				return res.redirect("/login");
			}
			return respons.error("Unauthorized", null, HttpStatus.UNAUTHORIZED, res, req);
		}

		const existingUser = await prisma.user.findUnique({ 
			where: { id: result.userId },
			include: { profile: true }
		});

		if (!existingUser || !existingUser.isActive) {
			if (req.accepts("html") && !req.path.startsWith("/api/")) {
				return res.redirect("/login");
			}
			return respons.error("User not found or inactive", null, HttpStatus.UNAUTHORIZED, res, req);
		}

		req.user = existingUser;
		next();
	},
};
