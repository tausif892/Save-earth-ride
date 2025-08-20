import { createHmac, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';

export interface SessionPayload {
	username: string;
	role: 'admin';
	exp: number; // unix seconds
}

export async function hashPassword(plain: string): Promise<string> {
	const salt = await bcrypt.genSalt(10);
	return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
	return bcrypt.compare(plain, hashed);
}

function base64UrlEncode(buffer: Buffer): string {
	return buffer
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function base64UrlEncodeString(input: string): string {
	return base64UrlEncode(Buffer.from(input, 'utf8'));
}

function base64UrlDecode(input: string): Buffer {
	const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
	const base64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
	return Buffer.from(base64, 'base64');
}

function sign(data: string, secret: string): string {
	const hmac = createHmac('sha256', secret);
	hmac.update(data);
	return base64UrlEncode(hmac.digest());
}

export function createSessionToken(payload: SessionPayload, secret: string): string {
	const json = JSON.stringify(payload);
	const encoded = base64UrlEncodeString(json);
	const signature = sign(encoded, secret);
	return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): SessionPayload | null {
	try {
		const [encoded, signature] = token.split('.');
		if (!encoded || !signature) return null;
		const expected = sign(encoded, secret);
		const sigBuf = Buffer.from(signature, 'utf8');
		const expBuf = Buffer.from(expected, 'utf8');
		if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
		const payloadJson = base64UrlDecode(encoded).toString('utf8');
		const payload = JSON.parse(payloadJson) as SessionPayload;
		if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
		return payload;
	} catch {
		return null;
	}
}
