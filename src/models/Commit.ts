import mongoose, { Schema, Document } from 'mongoose'

export interface ICommitDocument extends Document {
  repoId: mongoose.Types.ObjectId
  message: string
  author: string
  branch: string
  commitId: string
  timestamp: Date
  synced: boolean
  syncedAt: Date | null
  syncedBy: mongoose.Types.ObjectId | null
}

const CommitSchema = new Schema<ICommitDocument>({
  repoId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  message: { type: String, required: true },
  author: { type: String, required: true },
  branch: { type: String, required: true },
  commitId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  synced: { type: Boolean, default: false, index: true },
  syncedAt: { type: Date, default: null },
  syncedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
})

export default mongoose.models.Commit || mongoose.model<ICommitDocument>('Commit', CommitSchema)
