import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB });
  console.log(`✓ MongoDB connected (${env.MONGODB_DB})`);
}
