import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import connectDB from '@/lib/mongodb'
import Repository from '@/models/Repository'
import Commit from '@/models/Commit'
import { broadcast } from '@/lib/sse'

function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = createHmac('sha256', secret)
    const digest = Buffer.from('sha256=' + hmac.update(payload).digest('hex'), 'utf8')
    const sig = Buffer.from(signature, 'utf8')
    if (digest.length !== sig.length) return false
    return timingSafeEqual(digest, sig)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('x-hub-signature-256') ?? ''
    const event = request.headers.get('x-github-event') ?? ''

    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
    if (webhookSecret && signature) {
      if (!verifySignature(payload, signature, webhookSecret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    if (event !== 'push') {
      return NextResponse.json({ message: `Event "${event}" ignored` })
    }

    const data = JSON.parse(payload)
    const fullName: string = data.repository?.full_name ?? ''
    const [owner, repo] = fullName.split('/')

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Invalid payload: missing repository info' }, { status: 400 })
    }

    await connectDB()
    const repository = await Repository.findOne({ owner, repo })

    if (!repository) {
      return NextResponse.json({ message: 'Repository not tracked' })
    }

    repository.status = 'NOT_REVIEWED'
    repository.lastPushAt = new Date()
    await repository.save()

    const branch = (data.ref as string)?.replace('refs/heads/', '') ?? 'unknown'
    const commits: Array<{
      id: string
      message: string
      author: { name: string }
      timestamp: string
    }> = data.commits ?? []

    if (commits.length > 0) {
      await Commit.insertMany(
        commits.map((c) => ({
          repoId: repository._id,
          message: c.message,
          author: c.author?.name ?? 'Unknown',
          branch,
          commitId: c.id,
          timestamp: new Date(c.timestamp),
          synced: false,
          syncedAt: null,
          syncedBy: null,
        }))
      )
    }

    // Broadcast to all connected browser tabs via SSE
    const firstCommit = commits[0]
    const clientsNotified = broadcast('push', {
      repoId: repository._id.toString(),
      repoName: repository.name,
      branch,
      author: firstCommit?.author?.name ?? 'Unknown',
      message: firstCommit?.message ?? 'New push',
    })

    return NextResponse.json({
      message: 'Webhook processed',
      commits: commits.length,
      clientsNotified,
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
