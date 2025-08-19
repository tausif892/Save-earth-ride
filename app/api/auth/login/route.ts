import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, verifyPassword, hashPassword } from '@/lib/auth';
import clientPromise from '@/lib/mongo';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const DB_NAME = process.env.MONGODB_DB || 'app';

export async function POST(req: NextRequest) {
	try {
		let { username, password } = await req.json();
		if (typeof username === 'string') username = username.trim();
		if (typeof password === 'string') password = password.trim();
		if (!username || !password) {
			return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
		}
		const client = await clientPromise;
		const col = client.db(DB_NAME).collection('admins');

		// Bootstrap: if no admins exist, create the first admin from provided credentials
		const total = await col.estimatedDocumentCount();
		if (total === 0) {
			const now = new Date();
			await col.insertOne({
				id: Date.now(),
				username,
				email: `${username}@example.com`,
				password: await hashPassword(password),
				role: 'Super Admin',
				createdAt: now.toISOString().split('T')[0],
				lastLogin: now.toISOString().split('T')[0],
				status: 'active',
			});
		}
		// Case-insensitive username match using collation
		const admin = await col.findOne(
			{ username, status: { $ne: 'inactive' } },
			{ collation: { locale: 'en', strength: 2 } }
		);
		if (!admin || !admin.password) {
			return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
		}

		let ok = false;
		if (typeof admin.password === 'string' && admin.password.startsWith('$2')) {
			// Already hashed (bcrypt)
			ok = await verifyPassword(password, admin.password);
		} else {
			// Legacy plaintext stored. Compare directly, then migrate to bcrypt on success
			ok = password === admin.password;
			if (ok) {
				await col.updateOne(
					{ _id: admin._id },
					{ $set: { password: await hashPassword(password) } }
				);
			}
		}
		if (!ok) {
			return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const expiresInSeconds = 2 * 60 * 60; // 2h
		const payload = { username: admin.username, role: (admin.role || 'admin') as 'admin', exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
		const token = createSessionToken(payload, JWT_SECRET);

		const isProd = process.env.NODE_ENV === 'production';
		const res = NextResponse.json({ success: true, user: { username: admin.username, role: admin.role || 'admin' } });
		res.cookies.set('admin_session', token, {
			httpOnly: true,
			secure: isProd,
			sameSite: 'lax',
			path: '/',
			maxAge: expiresInSeconds,
		});
		return res;
	} catch (error: any) {
		return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
	}
}
