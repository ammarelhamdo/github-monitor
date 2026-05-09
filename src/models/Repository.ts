import mongoose, { Schema, Document } from 'mongoose'

export interface IRepositoryDocument extends Document {
  name: string
  owner: string
  repo: string
  url: string
  status: 'NOT_REVIEWED' | 'SYNCED' | 'FOLLOWING'
  assignedUsers: mongoose.Types.ObjectId[]
  permissions: Map<string, { canView: boolean; canEdit: boolean }>
  lastPushAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const RepositorySchema = new Schema<IRepositoryDocument>(
  {
    name: { type: String, required: true },
    owner: { type: String, required: true },
    repo: { type: String, required: true },
    url: { type: String, required: true },
    status: {
      type: String,
      enum: ['NOT_REVIEWED', 'SYNCED', 'FOLLOWING'],
      default: 'NOT_REVIEWED',
    },
    assignedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    permissions: {
      type: Map,
      of: new Schema(
        {
          canView: { type: Boolean, default: true },
          canEdit: { type: Boolean, default: false },
        },
        { _id: false }
      ),
      default: {},
    },
    lastPushAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.Repository ||
  mongoose.model<IRepositoryDocument>('Repository', RepositorySchema)
