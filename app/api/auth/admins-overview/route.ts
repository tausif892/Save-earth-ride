import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongo';

const DB_NAME = process.env.MONGODB_DB || 'app';
const RESET_SECRET = process.env.RESET_SECRET || '';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
	try {
		const isProd = process.env.NODE_ENV === 'production';
		if (isProd) {
			const key = req.headers.get('x-reset-secret') || '';
			if (!RESET_SECRET || key !== RESET_SECRET) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}
		}
		const client = await clientPromise;
		const col = client.db(DB_NAME).collection('admins');
		const admins = await col.find({}, { projection: { username: 1, email: 1, role: 1, status: 1 } }).toArray();
		return NextResponse.json({ admins });
	} catch (error: any) {
		return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
	}
}
