import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFileVersion {
  n: number;
  size: number;
  uploadedAt: Date;
  checksum?: string;
  key?: string;
}

export interface IFileDoc extends Document {
  name: string;
  ownerId: mongoose.Types.ObjectId;
  folderId: mongoose.Types.ObjectId | null;
  mime: string;
  currentVersion: number;
  versions: IFileVersion[];
  createdAt: Date;
  updatedAt: Date;
}

const fileVersionSchema = new Schema<IFileVersion>({
  n: { type: Number, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  checksum: String,
  key: String,
}, { _id: false });

const fileSchema = new Schema<IFileDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 255 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
    mime: { type: String, default: 'application/octet-stream' },
    currentVersion: { type: Number, default: 1 },
    versions: { type: [fileVersionSchema], default: [] },
  },
  { timestamps: true }
);

fileSchema.index({ ownerId: 1, folderId: 1, name: 1 }, { unique: true });

fileSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const FileDoc: Model<IFileDoc> = mongoose.model<IFileDoc>('File', fileSchema);
