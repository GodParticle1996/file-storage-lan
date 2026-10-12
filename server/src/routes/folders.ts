import { Router } from 'express';
import { z } from 'zod';
import { Folder, FileDoc } from '../models/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, asyncHandler } from '../middleware/validate.js';
import { httpError } from '../services/inviteService.js';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).max(20).optional(),
  parentFolderId: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const parent = req.query.parent === 'null' ? null : req.query.parent;
    const folders = await Folder.find({ ownerId: req.userId, parentFolderId: parent ?? null }).sort({ name: 1 });
    res.json({ folders: folders.map((f) => f.toJSON()) });
  })
);

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, description = '', tags = [], parentFolderId = null } = req.body as z.infer<typeof createSchema>;
    try {
      const folder = await Folder.create({
        name,
        description,
        tags,
        ownerId: req.userId,
        parentFolderId: parentFolderId || null,
      });
      res.status(201).json({ folder: folder.toJSON() });
    } catch (err: any) {
      if (err?.code === 11000) throw httpError(409, 'Folder with that name already exists');
      throw err;
    }
  })
);

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).max(20).optional(),
});

router.patch(
  '/:id',
  validate({ body: updateSchema }),
  asyncHandler(async (req: AuthRequest, res) => {
    const update = req.body as z.infer<typeof updateSchema>;
    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.userId },
      update,
      { new: true, runValidators: true }
    );
    if (!folder) throw httpError(404, 'Folder not found');
    res.json({ folder: folder.toJSON() });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    // Refuse to delete a non-empty folder — otherwise its files/subfolders
    // become orphans that no listing can reach.
    const [fileCount, subfolderCount] = await Promise.all([
      FileDoc.countDocuments({ ownerId: req.userId, folderId: req.params.id }),
      Folder.countDocuments({ ownerId: req.userId, parentFolderId: req.params.id }),
    ]);
    if (fileCount > 0 || subfolderCount > 0) {
      throw httpError(409, 'Folder is not empty — delete its files and subfolders first');
    }
    const folder = await Folder.findOneAndDelete({ _id: req.params.id, ownerId: req.userId });
    if (!folder) throw httpError(404, 'Folder not found');
    res.json({ ok: true });
  })
);

export default router;
