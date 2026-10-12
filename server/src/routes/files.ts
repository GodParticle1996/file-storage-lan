import { Router } from 'express';
import { z } from 'zod';
import { FileDoc, Folder, User } from '../models/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, asyncHandler } from '../middleware/validate.js';
import { httpError } from '../services/inviteService.js';
import { presignUpload, presignDownload, buildVersionKey, deleteObject } from '../services/r2Service.js';

const router = Router();
router.use(authMiddleware);

const listQuerySchema = z.object({
  parent: z.string().optional(),
});

router.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req: AuthRequest, res) => {
    const { parent } = (req as any).validatedQuery as z.infer<typeof listQuerySchema>;
    const folderId = parent && parent !== 'null' ? parent : null;
    const files = await FileDoc.find({ ownerId: req.userId, folderId }).sort({ name: 1 });
    res.json({ files: files.map((f) => f.toJSON()) });
  })
);

const beginUploadSchema = z.object({
  name: z.string().min(1).max(255),
  folderId: z.string().optional(),
  mime: z.string().default('application/octet-stream'),
  size: z.number().int().positive(),
});

router.post(
  '/begin-upload',
  validate({ body: beginUploadSchema }),
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, folderId = null, mime, size } = req.body as z.infer<typeof beginUploadSchema>;

    const folder = folderId
      ? await Folder.findOne({ _id: folderId, ownerId: req.userId })
      : null;
    if (folderId && !folder) throw httpError(404, 'Folder not found');

    let file = await FileDoc.findOne({ ownerId: req.userId, folderId: folderId, name });
    let nextVersion = 1;
    if (file) {
      nextVersion = file.currentVersion + 1;
    }

    const pendingId = file ? file.id : new (await import('mongoose')).default.Types.ObjectId().toString();
    const key = buildVersionKey(req.userId!, folderId || 'unfiled', name.replace(/\//g, '_'), nextVersion);

    const uploadUrl = await presignUpload(key, mime, size);

    res.json({
      uploadUrl,
      key,
      fileId: pendingId,
      version: nextVersion,
      isNew: !file,
    });
  })
);

const commitUploadSchema = z.object({
  key: z.string(),
  fileId: z.string(),
  name: z.string().min(1).max(255),
  folderId: z.string().optional(),
  mime: z.string().default('application/octet-stream'),
  size: z.number().int().nonnegative(),
  checksum: z.string().optional(),
});

router.post(
  '/commit',
  validate({ body: commitUploadSchema }),
  asyncHandler(async (req: AuthRequest, res) => {
    const { fileId, name, folderId = null, mime, size, checksum } = req.body as z.infer<typeof commitUploadSchema>;

    if (folderId) {
      const folder = await Folder.findOne({ _id: folderId, ownerId: req.userId });
      if (!folder) throw httpError(404, 'Folder not found');
    }

    let file;
    const versionEntry = {
      n: 0,
      size,
      uploadedAt: new Date(),
      checksum,
      key: req.body.key as string,
    };

    const existing = await FileDoc.findOne({ _id: fileId, ownerId: req.userId });
    if (existing) {
      if (existing.name !== name) throw httpError(400, 'Name mismatch');
      const newN = existing.currentVersion + 1;
      versionEntry.n = newN;
      existing.versions.push(versionEntry as any);
      existing.currentVersion = newN;
      existing.mime = mime;
      await existing.save();
      file = existing;
    } else {
      versionEntry.n = 1;
      file = await FileDoc.create({
        name,
        folderId,
        ownerId: req.userId,
        mime,
        currentVersion: 1,
        versions: [versionEntry],
      });
    }

    await User.updateOne({ _id: req.userId }, { $inc: { storageBytes: size } });

    res.json({ file: file.toJSON() });
  })
);

router.get(
  '/:id/download',
  asyncHandler(async (req: AuthRequest, res) => {
    const file = await FileDoc.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!file) throw httpError(404, 'File not found');
    const version = req.query.version ? Number(req.query.version) : file.currentVersion;
    if (!Number.isInteger(version) || version > file.currentVersion || version < 1) {
      throw httpError(400, 'Invalid version');
    }
    // Prefer the key recorded at upload time — rebuilding from the current name
    // breaks after a rename, since objects live under the original name.
    const entry = file.versions.find((v) => v.n === version);
    const key = entry?.key || buildVersionKey(req.userId!, file.folderId?.toString() || 'unfiled', file.name.replace(/\//g, '_'), version);
    const url = await presignDownload(key);
    res.json({ url, version, file: file.toJSON() });
  })
);

router.get(
  '/:id/versions',
  asyncHandler(async (req: AuthRequest, res) => {
    const file = await FileDoc.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!file) throw httpError(404, 'File not found');
    res.json({ versions: file.versions, current: file.currentVersion });
  })
);

const renameSchema = z.object({ name: z.string().min(1).max(255) });

router.patch(
  '/:id/rename',
  validate({ body: renameSchema }),
  asyncHandler(async (req: AuthRequest, res) => {
    const { name } = req.body as z.infer<typeof renameSchema>;
    const file = await FileDoc.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.userId },
      { name },
      { new: true }
    );
    if (!file) throw httpError(404, 'File not found');
    res.json({ file: file.toJSON() });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const file = await FileDoc.findOneAndDelete({ _id: req.params.id, ownerId: req.userId });
    if (!file) throw httpError(404, 'File not found');
    // Best-effort cleanup of stored objects; metadata is already gone.
    const keys = file.versions.map(
      (v) => v.key || buildVersionKey(req.userId!, file.folderId?.toString() || 'unfiled', file.name.replace(/\//g, '_'), v.n)
    );
    await Promise.allSettled(keys.map((k) => deleteObject(k)));
    const freed = file.versions.reduce((sum, v) => sum + (v.size || 0), 0);
    await User.updateOne({ _id: req.userId }, { $inc: { storageBytes: -freed } });
    res.json({ ok: true });
  })
);

export default router;
