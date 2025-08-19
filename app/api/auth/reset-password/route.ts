import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongo';
import { hashPassword } from '@/lib/auth';

const DB_NAME = process.env.MONGODB_DB || 'app';
const RESET_SECRET = process.env.RESET_SECRET || '';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
	try {
		const isProd = process.env.NODE_ENV === 'production';
		if (isProd) {
			const key = req.headers.get('x-reset-secret') || '';
			if (!RESET_SECRET || key !== RESET_SECRET) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}
		}
		const { username, newPassword } = await req.json();
		if (!username || !newPassword) {
			return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
		}
		const client = await clientPromise;
		const col = client.db(DB_NAME).collection('admins');
		const res = await col.updateOne(
			{ username },
			{ $set: { password: await hashPassword(newPassword) } }
		);
		if (res.matchedCount === 0) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}
		return NextResponse.json({ success: true });
	} catch (error: any) {
		return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
	}
}
