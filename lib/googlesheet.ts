import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

const SPREADSHEET_ID = '1JQOP0BInND1IVZZv29IkYmjJfl_Zl5LW68R57DS2iAg';

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
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    // auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    // token_uri: 'https://oauth2.googleapis.com/token',
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getSheetsClient() {
  const authClient = await auth.getClient() as JWT;
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  return sheets;
}

export { getSheetsClient, SPREADSHEET_ID, categories };