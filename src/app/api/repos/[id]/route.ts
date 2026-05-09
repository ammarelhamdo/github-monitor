import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import Repository from '@/models/Repository'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await connectDB()
    const repo = (await Repository.findById(id)
      .populate('assignedUsers', 'name email role')
      .lean()) as any

    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    if (session.user.role !== 'ADMIN') {
      const assigned = (repo.assignedUsers as any[]).some(
        (u: any) => (u._id || u).toString() === session.user.id
      )
      if (!assigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(repo)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch repository' }, { status: 500 })
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
    await connectDB()
    await Repository.findByIdAndDelete(id)

    return NextResponse.json({ message: 'Deleted' })
  } catch {
    return NextResponse.json({ error: 'Failed to delete repository' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    await connectDB()

    const repo = await Repository.findByIdAndUpdate(id, body, { new: true }).lean()
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    return NextResponse.json(repo)
  } catch {
    return NextResponse.json({ error: 'Failed to update repository' }, { status: 500 })
  }
}
