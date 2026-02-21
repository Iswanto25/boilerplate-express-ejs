import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
	DeleteObjectsCommand,
	ListObjectsV2Command,
	_Object,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { randomString } from "./utils";
dotenv.config({ quiet: process.env.NODE_ENV === "production" });

function normalizeEndpoint(raw?: string, useSSL?: boolean): string | null {
	if (!raw || !raw.trim()) return null;
	let e = raw.trim().replace(/\/+$/, "");
	if (!/^https?:\/\//i.test(e)) {
		e = `${useSSL ? "https" : "http"}://${e}`;
	}
	return e;
}

const USE_SSL = String(process.env.MINIO_USE_SSL || "").toLowerCase() === "true";
const ENDPOINT = normalizeEndpoint(process.env.MINIO_ENDPOINT, USE_SSL);
const REGION = process.env.MINIO_REGION?.trim() || "us-east-1";
const BUCKET = process.env.MINIO_BUCKET_NAME?.trim();
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY?.trim();
const SECRET_KEY = process.env.MINIO_SECRET_KEY?.trim();

const isS3Configured = !!(ENDPOINT && BUCKET && ACCESS_KEY && SECRET_KEY);

let s3: S3Client | null = null;

if (isS3Configured) {
	try {
		s3 = new S3Client({
			region: REGION,
			endpoint: ENDPOINT!,
			forcePathStyle: true,
			credentials: { accessKeyId: ACCESS_KEY!, secretAccessKey: SECRET_KEY! },
		});
		console.info("✅ S3/MinIO configured successfully");
	} catch (error) {
		console.warn("⚠️  S3/MinIO initialization failed - file upload features will be disabled");
		s3 = null;
	}
} else {
	console.warn(
		"⚠️  S3/MinIO not configured (MINIO_ENDPOINT, MINIO_BUCKET_NAME, MINIO_ACCESS_KEY, MINIO_SECRET_KEY) - file upload features will be disabled",
	);
}

function publicUrl(key: string): string {
	return `${ENDPOINT}/${BUCKET}/${key}`;
}

function throwS3NotConfigured(): never {
	throw {
		name: "S3NotConfiguredError",
		code: "S3_NOT_CONFIGURED",
		httpStatus: 503,
		message: "S3/MinIO storage is not configured",
		hint: "Please configure MINIO_ENDPOINT, MINIO_BUCKET_NAME, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY in your environment variables",
	};
}

export async function headFile(folder: string, file: string) {
	if (!s3) throwS3NotConfigured();

	const Key = `${folder}/${file}`;
	try {
		const res = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key }));
		return {
			exists: true as const,
			etag: res.ETag,
			contentLength: res.ContentLength,
			contentType: res.ContentType,
			lastModified: res.LastModified,
		};
	} catch (err: any) {
		if (err?.$metadata?.httpStatusCode === 404) return { exists: false as const };
		throw err;
	}
}

export async function uploadFile(file: Express.Multer.File, folder: string) {
	if (!s3) throwS3NotConfigured();

	const fileExtension = path.extname(file.originalname) || "";
	const fileName = `${randomString()}${fileExtension}`;
	const key = `${folder}/${fileName}`;
	const stream = fs.createReadStream(file.path);

	try {
		await s3.send(
			new PutObjectCommand({
				Bucket: BUCKET,
				Key: key,
				Body: stream,
				ContentType: file.mimetype || "application/octet-stream",
				Metadata: { uploadedBy: "api" },
			}),
		);
		return { fileName, folder };
	} finally {
		try {
			fs.unlinkSync(file.path);
		} catch {}
	}
}

export async function uploadBase64(folder: string, file: string, maxSizeInMB: number = 10, allowedFormats?: string[]) {
	if (!s3) throwS3NotConfigured();

	const totalStartTime = Date.now();

	if (typeof file !== "string") {
		throw {
			name: "UploadBase64Error",
			code: "INVALID_TYPE",
			httpStatus: 400,
			message: "Field 'file' harus berupa string base64 atau data URI.",
		};
	}

	const raw = file.trim();
	const dataUri = /^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/i;

	let mimeType = "application/octet-stream";
	let base64Data = raw;

	const m = raw.match(dataUri);
	if (m) {
		mimeType = m[1].toLowerCase();
		base64Data = m[2];
	} else {
		const sanitized = raw.replace(/\s+/g, "");
		base64Data = sanitized;
		mimeType = "image/jpeg";
	}

	const buffer = Buffer.from(base64Data, "base64");
	const maxBytes = maxSizeInMB * 1024 * 1024;
	if (buffer.length > maxBytes) {
		throw {
			name: "UploadBase64Error",
			code: "PAYLOAD_TOO_LARGE",
			httpStatus: 413,
			message: `Ukuran file terlalu besar. Maksimum ${maxSizeInMB}MB.`,
		};
	}

	const ext = (mimeType.split("/")[1] || "bin").toLowerCase();
	const fileName = `${randomString()}.${ext}`;
	const key = `${folder}/${fileName}`;

	try {
		await s3.send(
			new PutObjectCommand({
				Bucket: BUCKET,
				Key: key,
				Body: buffer,
				ContentType: mimeType,
				Metadata: { uploadedBy: "api" },
			}),
		);
	} catch (e: any) {
		throw {
			name: "UploadBase64Error",
			code: "STORAGE_WRITE_FAILED",
			httpStatus: 502,
			message: "Gagal menyimpan objek ke storage.",
		};
	}

	return { fileName, folder, url: publicUrl(key) };
}

export async function getFile(
	folder: string,
	file: string,
	expired: number = 3600,
	opts?: {
		ensureExists?: boolean;
		cacheControl?: string;
		contentDisposition?: "inline" | `attachment; filename="${string}"`;
		contentType?: string;
	},
): Promise<string | null> {
	if (!s3) return null;

	const ensureExists = opts?.ensureExists ?? true;
	const key = `${folder}/${file}`;

	try {
		if (ensureExists) {
			const head = await headFile(folder, file);
			if (!head.exists) return null;
		}

		const command = new GetObjectCommand({
			Bucket: BUCKET!,
			Key: key,
			ResponseCacheControl: opts?.cacheControl ?? "public, max-age=31536000, immutable",
			ResponseContentDisposition: opts?.contentDisposition ?? "inline",
			...(opts?.contentType ? { ResponseContentType: opts.contentType } : {}),
		});

		return await getSignedUrl(s3, command, { expiresIn: expired });
	} catch (error: any) {
		return null;
	}
}

export async function deleteFile(
	folder: string,
	file: string,
	opts?: { strict?: boolean; verifyAfter?: boolean },
): Promise<{ deleted: boolean; key: string; reason?: "not_found" | "still_exists" | "error" | "s3_not_configured" }> {
	if (!s3) return { deleted: false, key: `${folder}/${file}`, reason: "s3_not_configured" };

	const Key = `${folder}/${file}`;
	const strict = opts?.strict ?? true;

	try {
		if (strict) {
			const pre = await headFile(folder, file);
			if (!pre.exists) return { deleted: false, key: Key, reason: "not_found" };
		}

		await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key }));
		return { deleted: true, key: Key };
	} catch (error: any) {
		return { deleted: false, key: Key, reason: "error" };
	}
}

export { s3, isS3Configured };
