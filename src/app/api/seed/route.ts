import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import bcrypt from 'bcryptjs'

// One-time seed endpoint — creates the initial admin user
export async function POST() {
  try {
    await connectDB()

    const existing = await User.findOne({ role: 'ADMIN' })
    if (existing) {
      return NextResponse.json({ message: 'Admin user already exists' })
    }

    const hashed = await bcrypt.hash('admin123', 12)
    await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password: hashed,
      role: 'ADMIN',
    })

    return NextResponse.json({
      message: 'Admin user created successfully',
      credentials: { email: 'admin@example.com', password: 'admin123' },
    })
  } catch {
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 })
  }
}
