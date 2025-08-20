import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

function base64UrlToUint8Array(base64Url: string): Uint8Array {
	const pad = base64Url.length % 4 === 0 ? '' : '='.repeat(4 - (base64Url.length % 4));
	const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + pad;
	const str = atob(base64);
	const bytes = new Uint8Array(str.length);
	for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
	return bytes;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function verifyTokenEdge(token: string, secret: string): Promise<boolean> {
	try {
		const [encoded, signature] = token.split('.');
		if (!encoded || !signature) return false;
		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
		const expected = uint8ArrayToBase64Url(new Uint8Array(sigBuf));
		// timing-safe compare approximation
		if (expected.length !== signature.length) return false;
		let result = 0;
		for (let i = 0; i < expected.length; i++) {
			result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
		}
		if (result !== 0) return false;
		// decode payload to check exp
		const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(encoded));
		const payload = JSON.parse(payloadJson);
		if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return false;
		return true;
	} catch {
		return false;
	}
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	// Allow the login page ('/admin') publicly; protect deeper admin routes and the admin API
	const isAdminRoot = pathname === '/admin';
	const isProtectedAdminPath = /^\/admin\/.+/.test(pathname);
	const isProtectedApi = /^\/api\/admins(\/.*)?$/.test(pathname);
	const isProtected = isProtectedAdminPath || isProtectedApi;
	if (!isProtected) return NextResponse.next();

	const token = request.cookies.get('admin_session')?.value || '';
	const valid = token ? await verifyTokenEdge(token, JWT_SECRET) : false;
	if (!valid) {
		if (pathname.startsWith('/api/')) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		const loginUrl = new URL('/admin', request.url);
		return NextResponse.redirect(loginUrl);
	}
	return NextResponse.next();
}

export const config = {
	matcher: ['/admin/:path*', '/api/admins/:path*'],
};
