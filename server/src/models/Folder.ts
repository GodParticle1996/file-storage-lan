import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFolder extends Document {
  name: string;
  description: string;
  tags: string[];
  ownerId: mongoose.Types.ObjectId;
  parentFolderId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const folderSchema = new Schema<IFolder>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    tags: { type: [String], default: [] },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parentFolderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
  },
  { timestamps: true }
);

folderSchema.index({ ownerId: 1, parentFolderId: 1 });
folderSchema.index({ ownerId: 1, name: 1 }, { unique: true });

folderSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Folder: Model<IFolder> = mongoose.model<IFolder>('Folder', folderSchema);
