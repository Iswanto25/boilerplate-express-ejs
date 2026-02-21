import { Request, Response, NextFunction } from "express";
import { respons, HttpStatus } from "../utils/respons";
import { logger } from "../utils/logger";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
	logger.error({
		error: err.message,
		stack: err.stack,
		path: req.path,
		method: req.method,
	});

	const statusCode = err.statusCode || err.status || HttpStatus.INTERNAL_SERVER_ERROR;

	// If it's a web request (expects HTML), render error page
	if (req.accepts("html") && !req.path.startsWith("/api/")) {
		return res.status(statusCode).render("error", {
			message: err.message || "Internal server error",
			error: process.env.NODE_ENV === "development" ? err : {},
			status: statusCode,
		});
	}

	return respons.error(err.message || "Internal server error", null, statusCode, res, req);
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
	const message = `Route ${req.method} ${req.path} not found`;

	if (req.accepts("html") && !req.path.startsWith("/api/")) {
		return res.status(HttpStatus.NOT_FOUND).render("error", {
			message,
			error: {},
			status: HttpStatus.NOT_FOUND,
		});
	}

	return respons.error(message, null, HttpStatus.NOT_FOUND, res, req);
};
