import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { env } from '../config/env.js';

export async function bootstrapAdmin(): Promise<void> {
  const count = await User.countDocuments();
  if (count > 0) {
    console.log('✓ Admin bootstrap skipped (users already exist)');
    return;
  }
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await User.create({
    email: env.ADMIN_EMAIL.toLowerCase(),
    passwordHash,
    displayName: 'Administrator',
    role: 'admin',
    status: 'active',
  });
  console.log(`✓ Admin bootstrap complete (${env.ADMIN_EMAIL})`);
}
