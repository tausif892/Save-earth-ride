// app/api/admins/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { readAdminsFromSheet, writeAdminsToSheet } from '@/lib/googleSheetHelpers';
import { verifySessionToken } from '@/lib/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

function requireAuth(req: NextRequest): boolean {
	const token = req.cookies.get('admin_session')?.value || '';
	return !!(token && verifySessionToken(token, JWT_SECRET));
}

export async function GET(req: NextRequest) {
	if (!requireAuth(req)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	const data = await readAdminsFromSheet();
	// Never return password hashes to the client
	const sanitized = data.map(({ password, ...rest }) => rest);
	return NextResponse.json({ data: sanitized });
}

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
	if (!requireAuth(req)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const body = await req.json();
		// Validate the request body
		if (!Array.isArray(body)) {
			return NextResponse.json(
				{ error: 'Request body must be an array of admin objects' },
				{ status: 400 }
			);
		}

		await writeAdminsToSheet(body);
		return NextResponse.json({ success: true });
	} catch (error: any) {
		console.error('POST /api/admins error:', error);
		return NextResponse.json(
			{ error: error.message || 'Failed to update admin data' },
			{ status: 500 }
		);
	}
}
