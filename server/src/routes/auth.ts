import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Invite } from '../models/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, asyncHandler } from '../middleware/validate.js';
import { consumeInvite, signToken, httpError } from '../services/inviteService.js';

const router = Router();

const signupSchema = z.object({
  token: z.string().min(8),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

router.post(
  '/signup',
  validate({ body: signupSchema }),
  asyncHandler(async (req, res) => {
    const { token, email, password, displayName } = req.body as z.infer<typeof signupSchema>;

    const invite = await consumeInvite(token);
    const existing = await User.findOne({ email });
    if (existing) throw httpError(409, 'Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      passwordHash,
      displayName,
      role: 'user',
      status: 'active',
    });

    invite.status = 'used';
    invite.usedBy = user._id;
    await (invite as any).save();

    const jwt = signToken(user.id);
    res.status(201).json({
      token: jwt,
      user: user.toJSON(),
    });
  })
);

router.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await User.findOne({ email });
    if (!user) throw httpError(401, 'Invalid credentials');
    if (user.status === 'disabled') throw httpError(403, 'Account disabled');
    const ok = await user.comparePassword(password);
    if (!ok) throw httpError(401, 'Invalid credentials');

    res.json({
      token: signToken(user.id),
      user: user.toJSON(),
    });
  })
);

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

router.post('/logout', authMiddleware, (_req, res) => {
  res.json({ ok: true });
});

router.get(
  '/invite/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    const invite = await Invite.findOne({ token });
    if (!invite) throw httpError(404, 'Invite not found');
    let status: 'valid' | 'used' | 'revoked' | 'expired' = 'valid';
    if (invite.status === 'used') status = 'used';
    else if (invite.status === 'revoked') status = 'revoked';
    else if (invite.expiresAt < new Date()) status = 'expired';
    res.json({ status, expiresAt: invite.expiresAt });
  })
);

export default router;
