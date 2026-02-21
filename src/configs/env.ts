import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	PORT: z.string().transform(Number).default("3004"),
	DATABASE_URL: z.string().url(),
	REDIS_HOST: z.string().default("127.0.0.1"),
	REDIS_PORT: z.string().transform(Number).default("6379"),
	REDIS_PASSWORD: z.string().optional(),
	SESSION_SECRET: z.string().min(32),
	JWT_SECRET: z.string(),
	JWT_REFRESH_SECRET: z.string(),
	DATA_ENCRYPTION_KEY: z.string(),
	APP_NAME: z.string().default("Boilerplate Express"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error("❌ Invalid environment variables:", parsedEnv.error.format());
	process.exit(1);
}

export const env = parsedEnv.data;
