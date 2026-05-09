import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import Repository from '@/models/Repository'
import mongoose from 'mongoose'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { userId, canView = true, canEdit = false } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    await connectDB()
    const repo = await Repository.findById(id)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    const alreadyAssigned = repo.assignedUsers.some(
      (uid: mongoose.Types.ObjectId) => uid.toString() === userId
    )
    if (!alreadyAssigned) repo.assignedUsers.push(new mongoose.Types.ObjectId(userId))

    repo.permissions.set(userId, { canView, canEdit })
    await repo.save()

    const populated = await repo.populate('assignedUsers', 'name email role')
    return NextResponse.json(populated)
  } catch {
    return NextResponse.json({ error: 'Failed to assign user' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    await connectDB()
    const repo = await Repository.findById(id)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    repo.assignedUsers = repo.assignedUsers.filter(
      (uid: mongoose.Types.ObjectId) => uid.toString() !== userId
    )
    repo.permissions.delete(userId)
    await repo.save()

    const populated = await repo.populate('assignedUsers', 'name email role')
    return NextResponse.json(populated)
  } catch {
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 })
  }
}
