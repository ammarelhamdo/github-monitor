import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import Repository from '@/models/Repository'

const VALID_STATUSES = ['NOT_REVIEWED', 'SYNCED', 'FOLLOWING']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { status } = await request.json()

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    await connectDB()
    const repo = await Repository.findById(id)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    if (session.user.role !== 'ADMIN') {
      const perms = repo.permissions.get(session.user.id)
      if (!perms?.canEdit) {
        return NextResponse.json({ error: 'No edit permission' }, { status: 403 })
      }
    }

    repo.status = status
    await repo.save()

    return NextResponse.json(repo)
  } catch {
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
