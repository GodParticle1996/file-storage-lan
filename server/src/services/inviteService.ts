import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Invite, IInvite } from '../models/index.js';
import { addDays } from '../utils/date.js';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}

export async function createInvite(createdBy: string, expiresDays: number = env.INVITE_EXPIRES_DAYS): Promise<{ token: string; url: string; expiresAt: Date }> {
  const invite = await Invite.create({
    token: nanoid(24),
    createdBy,
    status: 'pending',
    expiresAt: addDays(new Date(), expiresDays),
  });
  return {
    token: invite.token,
    url: `${env.PUBLIC_BASE_URL}/invite/${invite.token}`,
    expiresAt: invite.expiresAt,
  };
}

export async function consumeInvite(token: string): Promise<IInvite> {
  const invite = await Invite.findOne({ token });
  if (!invite) throw httpError(404, 'Invite not found');
  if (invite.status === 'used') throw httpError(410, 'Invite already used');
  if (invite.status === 'revoked') throw httpError(410, 'Invite has been revoked');
  if (invite.expiresAt < new Date()) throw httpError(410, 'Invite has expired');
  return invite;
}

export function httpError(status: number, message: string): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}
