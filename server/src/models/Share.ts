import mongoose, { Document, Schema, Model } from 'mongoose';

export type ShareType = 'folder' | 'file';
export type SharePermission = 'read' | 'write';
export type ShareScope = 'link' | 'direct';

export interface IShare extends Document {
  token: string;
  type: ShareType;
  resourceId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  permission: SharePermission;
  scope: ShareScope;
  /** If scope=direct, the specific user this share was sent to. */
  targetUserId?: mongoose.Types.ObjectId | null;
  revokedAt?: Date | null;
  acceptedBy: mongoose.Types.ObjectId[];
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const shareSchema = new Schema<IShare>(
  {
    token: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['folder', 'file'], required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    permission: { type: String, enum: ['read', 'write'], required: true },
    scope: { type: String, enum: ['link', 'direct'], default: 'link' },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    revokedAt: { type: Date, default: null },
    acceptedBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

shareSchema.index({ resourceId: 1, type: 1 });

shareSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Share: Model<IShare> = mongoose.model<IShare>('Share', shareSchema);
