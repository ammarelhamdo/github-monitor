import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import Commit from '@/models/Commit'
import Repository from '@/models/Repository'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { repoId } = await params
    await connectDB()

    if (session.user.role !== 'ADMIN') {
      const repo = await Repository.findById(repoId)
      if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

      const hasAccess = repo.assignedUsers.some((uid: unknown) => String(uid) === session.user.id)
      if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const commits = await Commit.find({ repoId })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean()

    return NextResponse.json(commits)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch commits' }, { status: 500 })
  }
}
