import { config as dotenvConfig } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3010', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/deckpipe',
  apiUrl: process.env.API_URL || 'http://localhost:3010',
  viewerUrl: process.env.VIEWER_URL || 'http://localhost:5173',
  imageStoragePath: process.env.IMAGE_STORAGE_PATH || './data/images',
  adminUsername: process.env.ADMIN_USERNAME || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY || '',
};
