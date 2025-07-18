import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// Your Spreadsheet ID and categories remain the same
const SPREADSHEET_ID = '1IiriZCjD_FHO2nclc2By2ynEgUzTTaOd_89Uxr2hCoE';
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

// Function to get the Google Sheets client
async function getSheetsClient() {
  // 1. Get the JSON credentials string from the environment variable
  const credentialsJson = process.env.GCP_CREDDENTIALS;
  if (!credentialsJson) {
    throw new Error('GCP_CREDDENTIALS environment variable is not set.');
  }

  // 2. Parse the JSON string into an object
  const credentials = JSON.parse(credentialsJson);

  // 3. Authorize a client with the parsed credentials
  const authClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth: authClient });
  return sheets;
}

export { getSheetsClient, SPREADSHEET_ID, categories };
