import mongoose, { Document, Schema, Model } from 'mongoose';

export type InviteStatus = 'pending' | 'used' | 'revoked';

export interface IInvite extends Document {
  token: string;
  createdBy: mongoose.Types.ObjectId;
  status: InviteStatus;
  usedBy?: mongoose.Types.ObjectId | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inviteSchema = new Schema<IInvite>(
  {
    token: { type: String, required: true, unique: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'used', 'revoked'], default: 'pending', index: true },
    usedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

inviteSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Invite: Model<IInvite> = mongoose.model<IInvite>('Invite', inviteSchema);
