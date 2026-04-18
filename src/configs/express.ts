import express, { Request, Response } from "express";
import cors from "cors";
import compression from "compression";
import { pinoHttp } from "pino-http";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import session from "express-session";
import flash from "connect-flash";
import expressLayouts from "express-ejs-layouts";
import { RedisStore } from "connect-redis";
import { doubleCsrf } from "csrf-csrf";

import { logger } from "@/utils/logger.js";
import { errorHandler, notFoundHandler } from "@/middlewares/error.handler.js";
import { redisClient } from "@/configs/redis.js";
import { env } from "@/configs/env.js";
import routes from "@/routes/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../../../views"));

// EJS Layouts configuration
app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

// Declare module for request user
declare module "express-serve-static-core" {
	interface Request {
		user?: any;
		startTime?: number;
		csrfToken?: (overwrite?: boolean, validateOnReuse?: boolean) => string;
	}
}

// Security Middleware
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
				styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
				imgSrc: ["'self'", "data:", "blob:"],
				fontSrc: ["'self'", "https://fonts.gstatic.com"],
				connectSrc: ["'self'"],
				frameAncestors: ["'none'"],
				baseUri: ["'self'"],
				formAction: ["'self'"],
				objectSrc: ["'none'"],
				scriptSrcAttr: ["'none'"],
				upgradeInsecureRequests: [],
			},
		},
		crossOriginEmbedderPolicy: { policy: "require-corp" },
		crossOriginOpenerPolicy: { policy: "same-origin" },
		crossOriginResourcePolicy: { policy: "same-origin" },
		originAgentCluster: true,
		referrerPolicy: { policy: "no-referrer" },
		strictTransportSecurity: {
			maxAge: 63072000,
			includeSubDomains: true,
			preload: true,
		},
		xContentTypeOptions: true,
		xDnsPrefetchControl: { allow: false },
		xDownloadOptions: true,
		xFrameOptions: { action: "deny" },
		xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
	}),
);

// Session configuration with Redis
const redisStore = new RedisStore({
	client: redisClient!,
	prefix: "sess:",
});

app.use(
	session({
		store: redisStore,
		secret: env.SESSION_SECRET,
		resave: false,
		saveUninitialized: false,
		cookie: {
			secure: env.NODE_ENV === "production",
			httpOnly: true,
			maxAge: 24 * 60 * 60 * 1000, // 24 hours
		},
	}),
);

app.use(flash());
app.use(cookieParser(env.SESSION_SECRET));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(compression());
app.use(cors()); // Standard CORS

// CSRF Protection configuration
export const { generateToken, doubleCsrfProtection, invalidCsrfTokenError } = doubleCsrf({
	getSecret: (req) => env.SESSION_SECRET,
	cookieName: "x-csrf-token",
	cookieOptions: {
		secure: env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
	},
	size: 64,
	ignoredMethods: ["GET", "HEAD", "OPTIONS"],
});

// Global View Middleware
app.use((req, res, next) => {
	res.locals.user = (req as any).user || null;
	res.locals.messages = req.flash();
	// Make CSRF token available in all views
	if (typeof generateToken === "function") {
		res.locals.csrfToken = generateToken(req, res);
	}
	next();
});

// Static files
app.use(express.static(path.join(__dirname, "../../../public")));

// Response time tracking
app.use((req, res, next) => {
	req.startTime = Date.now();
	next();
});

app.use(
	pinoHttp({
		logger,
		autoLogging: false,
		customSuccessMessage: (req: Request, res: Response, responseTime: number) => {
			return `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`;
		},
		quietReqLogger: true,
	}),
);

// Routes
app.use("/", routes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);
