import 'dotenv/config';
import { db } from './lib/db';

async function clear() {
  await db.queryHistory.deleteMany();
  console.log("Cache cleared!");
  process.exit(0);
}

clear();
