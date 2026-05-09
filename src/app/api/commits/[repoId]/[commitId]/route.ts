import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import Commit from '@/models/Commit'
import Repository from '@/models/Repository'
import { broadcast } from '@/lib/sse'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ repoId: string; commitId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { repoId, commitId } = await params
    const { synced }: { synced: boolean } = await request.json()

    await connectDB()

    const repo = await Repository.findById(repoId)
    if (!repo) return NextResponse.json({ error: 'Repository not found' }, { status: 404 })

    const isAdmin = session.user.role === 'ADMIN'
    if (!isAdmin) {
      const perms = repo.permissions?.get?.(session.user.id)
      if (!perms?.canEdit) {
        return NextResponse.json({ error: 'Forbidden — edit permission required' }, { status: 403 })
      }
    }

    const commit = await Commit.findByIdAndUpdate(
      commitId,
      {
        synced,
        syncedAt: synced ? new Date() : null,
        syncedBy: synced ? session.user.id : null,
      },
      { new: true }
    )
    if (!commit) return NextResponse.json({ error: 'Commit not found' }, { status: 404 })

    // Auto-update repo status based on aggregate commit sync state
    const unsyncedCount = await Commit.countDocuments({ repoId, synced: false })
    let repoStatus = repo.status

    if (synced && unsyncedCount === 0) {
      // All commits are synced — promote repo to SYNCED automatically
      repo.status = 'SYNCED'
      await repo.save()
      repoStatus = 'SYNCED'
      broadcast('status', { repoId, status: 'SYNCED' })
    } else if (!synced && repo.status === 'SYNCED') {
      // Un-syncing a commit on an already-SYNCED repo — revert to NOT_REVIEWED
      repo.status = 'NOT_REVIEWED'
      await repo.save()
      repoStatus = 'NOT_REVIEWED'
      broadcast('status', { repoId, status: 'NOT_REVIEWED' })
    }

    return NextResponse.json({ commit, repoStatus, unsyncedCount })
  } catch {
    return NextResponse.json({ error: 'Failed to update commit' }, { status: 500 })
  }
}
