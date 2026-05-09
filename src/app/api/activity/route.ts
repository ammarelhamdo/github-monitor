import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import Commit from '@/models/Commit'
import Repository from '@/models/Repository'

export interface ActivityItem {
  id: string
  type: 'push' | 'repo_added'
  repoId: string
  repoName: string
  repoUrl: string
  timestamp: string
  // push-specific
  author?: string
  branch?: string
  message?: string
  commitId?: string
  synced?: boolean
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const isAdmin = session.user.role === 'ADMIN'
    const baseFilter = isAdmin ? {} : { assignedUsers: session.user.id }

    // Repos this user can see
    const repos = (await Repository.find(baseFilter)
      .select('_id name url createdAt')
      .lean()) as any[]

    const repoIds = repos.map((r) => r._id)
    const repoMeta = new Map(repos.map((r) => [r._id.toString(), { name: r.name, url: r.url }]))

    // Recent commits (push events)
    const commits = (await Commit.find({ repoId: { $in: repoIds } })
      .sort({ timestamp: -1 })
      .limit(40)
      .lean()) as any[]

    const pushItems: ActivityItem[] = commits.map((c) => ({
      id: c._id.toString(),
      type: 'push',
      repoId: c.repoId.toString(),
      repoName: repoMeta.get(c.repoId.toString())?.name ?? 'Unknown',
      repoUrl: repoMeta.get(c.repoId.toString())?.url ?? '',
      timestamp: c.timestamp,
      author: c.author,
      branch: c.branch,
      message: c.message,
      commitId: c.commitId,
      synced: (c as any).synced ?? false,
    }))

    // Recently added repos
    const repoAdded: ActivityItem[] = repos
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15)
      .map((r) => ({
        id: `added_${r._id}`,
        type: 'repo_added',
        repoId: r._id.toString(),
        repoName: r.name,
        repoUrl: r.url,
        timestamp: r.createdAt,
      }))

    const merged = [...pushItems, ...repoAdded]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50)

    return NextResponse.json(merged)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
