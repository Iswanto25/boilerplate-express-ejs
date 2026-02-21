import crypto from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const DEFAULT_VERSION = 1;

const DATA_ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || "your-32-char-hex-key-here-change-this-in-production";
let cachedKey: Buffer | null = null;

const loadKey = (): Buffer => {
	if (cachedKey) return cachedKey;
	let keyBuffer: Buffer;
	if (/^[0-9a-fA-F]{64}$/.test(DATA_ENCRYPTION_KEY)) {
		keyBuffer = Buffer.from(DATA_ENCRYPTION_KEY, "hex");
	} else {
		keyBuffer = Buffer.from(DATA_ENCRYPTION_KEY, "utf8").subarray(0, 32);
	}
	cachedKey = keyBuffer;
	return cachedKey;
};

export interface EncryptionPayload {
	version: number;
	ciphertext: string;
}

export function encryptSensitive(value: string): EncryptionPayload {
	const key = loadKey();
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();
	const payload = Buffer.concat([iv, authTag, ciphertext]).toString("base64");
	return { version: DEFAULT_VERSION, ciphertext: payload };
}

export function decryptSensitive(payload: EncryptionPayload): string {
	const key = loadKey();
	const raw = Buffer.from(payload.ciphertext, "base64");
	const iv = raw.subarray(0, IV_LENGTH);
	const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
	const encrypted = raw.subarray(IV_LENGTH + 16);
	const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);
	return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export const encryptionUtils = { encryptSensitive, decryptSensitive };
