import mongoose, { Schema, Document } from 'mongoose'

export interface IUserDocument extends Document {
  name: string
  email: string
  password: string
  role: 'ADMIN' | 'EMPLOYEE'
  createdAt: Date
}

const UserSchema = new Schema<IUserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'EMPLOYEE'], default: 'EMPLOYEE' },
  },
  { timestamps: true }
)

export default mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema)
