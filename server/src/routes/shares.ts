import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { Share, FileDoc, Folder } from '../models/index.js';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { validate, asyncHandler } from '../middleware/validate.js';
import { httpError } from '../services/inviteService.js';
import { env } from '../config/env.js';

const router = Router();

// Public (optionally authenticated): lets a logged-out visitor see what a
// share link points to before being asked to sign in and accept it.
router.get(
  '/:token',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const share = await verifyShare(req.params.token, req.userId);
    let resource: any = null;
    if (share.type === 'folder') {
      resource = await Folder.findById(share.resourceId);
    } else {
      resource = await FileDoc.findById(share.resourceId);
    }
    res.json({ share: share.toJSON(), resource: resource ? resource.toJSON() : null });
  })
);

router.use(authMiddleware);

const createShareSchema = z.object({
  type: z.enum(['folder', 'file']),
  resourceId: z.string(),
  permission: z.enum(['read', 'write']),
  targetEmail: z.string().email().optional(),
  expiresDays: z.number().int().min(1).max(90).optional(),
});

router.post(
  '/',
  validate({ body: createShareSchema }),
  asyncHandler(async (req: AuthRequest, res) => {
    const body = req.body as z.infer<typeof createShareSchema>;

    let targetUserId = null;
    if (body.targetEmail) {
      const target = await (await import('../models/index.js')).User.findOne({ email: body.targetEmail.toLowerCase() });
      if (!target) throw httpError(404, 'Target user not found');
      targetUserId = target._id;
    }

    const owns = await ownsResource(req.userId!, body.type, body.resourceId);
    if (!owns) throw httpError(403, 'You can only share resources you own');

    let expiresAt: Date | null = null;
    if (body.expiresDays) {
      const d = new Date();
      d.setDate(d.getDate() + body.expiresDays);
      expiresAt = d;
    }

    const share = await Share.create({
      token: nanoid(24),
      type: body.type,
      resourceId: body.resourceId,
      ownerId: req.userId,
      permission: body.permission,
      scope: body.targetEmail ? 'direct' : 'link',
      targetUserId,
      expiresAt,
    });

    res.status(201).json({
      token: share.token,
      url: `${env.PUBLIC_BASE_URL}/share/${share.token}`,
      permission: share.permission,
      expiresAt: share.expiresAt,
      type: share.type,
      scope: share.scope,
    });
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const shares = await Share.find({
      $or: [
        { ownerId: req.userId },
        { targetUserId: req.userId },
        { acceptedBy: req.userId },
      ],
    });
    res.json({ shares: shares.map((s) => s.toJSON()) });
  })
);

router.post(
  '/:token/accept',
  asyncHandler(async (req: AuthRequest, res) => {
    const share = await verifyShare(req.params.token, req.userId!);
    if (!share.acceptedBy.map((id: any) => id.toString()).includes(req.userId!)) {
      share.acceptedBy.push(req.userId as any);
      await share.save();
    }
    res.json({ share: share.toJSON() });
  })
);

router.delete(
  '/:token/revoke',
  asyncHandler(async (req: AuthRequest, res) => {
    const share = await Share.findOne({ token: req.params.token, ownerId: req.userId });
    if (!share) throw httpError(404, 'Share not found');
    share.revokedAt = new Date();
    await share.save();
    res.json({ ok: true });
  })
);

async function verifyShare(token: string, userId?: string): Promise<any> {
  const share = await Share.findOne({ token });
  if (!share) throw httpError(404, 'Share not found');
  if (share.revokedAt) throw httpError(410, 'Share has been revoked');
  if (share.expiresAt && share.expiresAt < new Date()) throw httpError(410, 'Share has expired');
  if (share.scope === 'direct' && (!userId || !share.targetUserId?.equals(userId))) {
    throw httpError(403, 'This share was not created for your account');
  }
  return share;
}

async function ownsResource(userId: string, type: 'folder' | 'file', resourceId: string): Promise<boolean> {
  if (type === 'folder') return !!await Folder.findOne({ _id: resourceId, ownerId: userId });
  return !!await FileDoc.findOne({ _id: resourceId, ownerId: userId });
}

export default router;
