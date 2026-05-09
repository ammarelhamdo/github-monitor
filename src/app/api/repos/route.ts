import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import Repository from '@/models/Repository'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const repos = session.user.role === 'ADMIN'
      ? await Repository.find({}).populate('assignedUsers', 'name email role').sort({ updatedAt: -1 }).lean()
      : await Repository.find({ assignedUsers: session.user.id })
          .populate('assignedUsers', 'name email role')
          .sort({ updatedAt: -1 })
          .lean()

    return NextResponse.json(repos)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch repos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await request.json()
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/)
    if (!match) return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 })

    const owner = match[1]
    const repo = match[2]
    const name = `${owner}/${repo}`

    await connectDB()

    const existing = await Repository.findOne({ owner, repo })
    if (existing) return NextResponse.json({ error: 'Repository already tracked' }, { status: 409 })

    const newRepo = await Repository.create({
      name,
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
      status: 'NOT_REVIEWED',
    })

    return NextResponse.json(newRepo, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to add repository' }, { status: 500 })
  }
}
