import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import path from 'path';

const keyPath = path.resolve(process.cwd(), 'lib/credentials.json');

const SPREADSHEET_ID = /*'1ai04GFQ-aCVzi54x2ZeuDXtasd7Y8ATCr7R1bSqMrNQ';*/
'1JQOP0BInND1IVZZv29IkYmjJfl_Zl5LW68R57DS2iAg';

const categories = [
  'drives',
  'blog',
  'gallery',
  'map',
  'timeline',
  'treecounter',
  'admins',
  'sponsors',
  'registrations',
  'donations',
];

const auth = new google.auth.GoogleAuth({
  keyFile: keyPath,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getSheetsClient() {
  const authClient = await auth.getClient() as JWT;

  const sheets = google.sheets({ version: 'v4', auth: authClient });
  return sheets;
}

export { getSheetsClient, SPREADSHEET_ID, categories };