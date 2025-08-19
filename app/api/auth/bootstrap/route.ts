import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongo';

const DB_NAME = process.env.MONGODB_DB || 'app';

export const dynamic = 'force-dynamic';

export async function GET() {
	try {
		const client = await clientPromise;
		const col = client.db(DB_NAME).collection('admins');
		const count = await col.estimatedDocumentCount();
		return NextResponse.json({ hasAdmin: count > 0, count });
	} catch (error: any) {
		return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
	}
}
