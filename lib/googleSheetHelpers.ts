import clientPromise from './mongo';
import { Collection } from 'mongodb';
import { hashPassword } from './auth';

export interface Admin {
  id: number;
  username: string;
  email: string;
  password: string;
  role: string;
  createdAt?: string;
  lastLogin?: string;
  status?: string;
}

const DB_NAME           = process.env.MONGODB_DB || 'app';
const ADMIN_COLLECTION  = 'admins';          
const CACHE_TTL         = 5 * 60_000;        

interface CacheEntry {
  data: Admin[];
  timestamp: number;
}

let cache: CacheEntry | null = null;
let collectionReady = false;

async function getCollection(): Promise<Collection<Admin>> {
  const client = await clientPromise;
  const col    = client.db(DB_NAME).collection<Admin>(ADMIN_COLLECTION);

  if (!collectionReady) {
    await col.createIndex({ id: 1 }, { unique: true });
    collectionReady = true;
  }
  return col;
}

function hasAdminChanged(existing: Admin, incoming: Admin): boolean {
  const fields = [
    'username',
    'email',
    'password',
    'role',
    'createdAt',
    'lastLogin',
    'status',
  ] as const;

  return fields.some(
    (f) => (existing as any)[f] !== (incoming as any)[f],
  );
}


export async function readAdminsFromSheet(): Promise<Admin[]> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL) return cache.data;

  const col   = await getCollection();
  const docs  = await col.find({}).toArray();
  const admins = docs.map(({ _id, ...rest }) => rest as Admin);

  cache = { data: admins, timestamp: now };
  return admins;
}


export async function writeAdminsToSheet(admins: Admin[]) {
  const col            = await getCollection();
  const existingAdmins = await readAdminsFromSheet();
  const existingMap    = new Map(existingAdmins.map((a) => [a.id, a]));

  const newAdmins: Admin[] = [];
  const changedAdmins: Admin[] = [];

  for (const adm of admins) {
    const prev = existingMap.get(adm.id);
    const normalized: Admin = { ...adm };

    // Password handling:
    // - If creating new admin and password is provided but not hashed, hash it
    // - If updating and password is empty, preserve previous hashed password
    // - If updating and password provided (plaintext), hash it; if already hashed ($2...), keep as-is
    if (prev) {
      if (typeof normalized.password === 'string') {
        const pwd = normalized.password.trim();
        if (pwd === '' && typeof prev.password === 'string' && prev.password.length > 0) {
          normalized.password = prev.password;
        } else if (!pwd.startsWith('$2')) {
          normalized.password = await hashPassword(pwd);
        }
      } else if (prev.password) {
        normalized.password = prev.password;
      }
    } else {
      if (typeof normalized.password === 'string' && normalized.password.length > 0 && !normalized.password.startsWith('$2')) {
        normalized.password = await hashPassword(normalized.password);
      }
    }

    if (!prev) {
      newAdmins.push(normalized);
    } else if (hasAdminChanged(prev, normalized)) {
      changedAdmins.push(normalized);
    }
  }

  if (changedAdmins.length) {
    await col.bulkWrite(
      changedAdmins.map((adm) => ({
        updateOne: {
          filter: { id: adm.id },
          update: { $set: { ...adm } },
        },
      })),
    );
  }

  if (newAdmins.length) {
    await col.insertMany(newAdmins);
  }

  if (cache) {
    changedAdmins.forEach((adm) => {
      const idx = cache!.data.findIndex((a) => a.id === adm.id);
      if (idx !== -1) cache!.data[idx] = adm;
    });
    cache.data.push(...newAdmins);
    cache.timestamp = Date.now();
  }

  return {
    success: true,
    newAdmins: newAdmins.length,
    updatedAdmins: changedAdmins.length,
  };
}


export async function replaceAdminsInSheet(admins: Admin[]) {
  const col = await getCollection();
  await col.deleteMany({});
  if (admins.length) {
    await col.insertMany(admins);
  }
  cache = null;
  return { success: true, totalAdmins: admins.length };
}


export async function addSingleAdmin(admin: Admin) {
  const col   = await getCollection();
  const found = await col.findOne({ id: admin.id });
  if (found) {
    return { success: false, message: 'Admin already exists' };
  }
  await writeAdminsToSheet([admin]);
  return { success: true, message: 'Admin added' };
}

export function invalidateAdminCache() {
  cache = null;
}

export function getAdminCacheStats() {
  return {
    cached: cache !== null,
    age: cache ? Date.now() - cache.timestamp : 0,
    size: cache ? cache.data.length : 0,
  };
}
