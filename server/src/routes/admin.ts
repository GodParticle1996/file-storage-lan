import { Router } from 'express';
import { z } from 'zod';
import { User, Invite } from '../models/index.js';
import { authMiddleware, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { validate, asyncHandler } from '../middleware/validate.js';
import { createInvite, httpError } from '../services/inviteService.js';

const router = Router();

router.use(authMiddleware, requireAdmin);

router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: 1 }).lean();
    res.json({ users: users.map((u) => ({ ...u, id: u._id.toString(), _id: undefined })) });
  })
);

const inviteCreateSchema = z.object({
  expiresDays: z.number().int().min(1).max(90).optional(),
});

router.post(
  '/invites',
  validate({ body: inviteCreateSchema }),
  asyncHandler(async (req: AuthRequest, res) => {
    const { expiresDays } = req.body as z.infer<typeof inviteCreateSchema>;
    const invite = await createInvite(req.userId!, expiresDays ?? undefined);
    res.status(201).json(invite);
  })
);

router.get(
  '/invites',
  asyncHandler(async (_req, res) => {
    const invites = await Invite.find()
      .sort({ createdAt: -1 })
    res.json({
      invites: invites.map((i) => ({ ...i.toJSON() })),
    });
  })
);

router.delete(
  '/invites/:token',
  asyncHandler(async (req, res) => {
    const invite = await Invite.findOneAndUpdate(
      { token: req.params.token },
      { status: 'revoked' },
      { new: true }
    );
    if (!invite) throw httpError(404, 'Invite not found');
    res.json({ ok: true });
  })
);

const updateUserSchema = z.object({
  status: z.enum(['active', 'disabled']).optional(),
  role: z.enum(['admin', 'user']).optional(),
  displayName: z.string().min(1).max(80).optional(),
});

router.patch(
  '/users/:id',
  validate({ body: updateUserSchema }),
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.params.id === req.userId) {
      throw httpError(400, 'Cannot modify your own account via admin endpoint');
    }
    const update = req.body as z.infer<typeof updateUserSchema>;
    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!user) throw httpError(404, 'User not found');
    res.json({ user: user.toJSON() });
  })
);

router.delete(
  '/users/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.params.id === req.userId) {
      throw httpError(400, 'Cannot delete your own account via admin endpoint');
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw httpError(404, 'User not found');
    res.json({ ok: true });
  })
);

export default router;
