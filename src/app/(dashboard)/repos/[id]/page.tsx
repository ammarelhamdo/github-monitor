'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import { IRepository, ICommit, IUser, RepoStatus } from '@/types'
import { PUSH_EVENT, PushEventDetail } from '@/components/providers/RealtimeProvider'

const ALL_STATUSES: RepoStatus[] = ['NOT_REVIEWED', 'SYNCED', 'FOLLOWING']

export default function RepoDetailPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [repo, setRepo] = useState<IRepository | null>(null)
  const [commits, setCommits] = useState<ICommit[]>([])
  const [allUsers, setAllUsers] = useState<IUser[]>([])
  const [loading, setLoading] = useState(true)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [assignLoading, setAssignLoading] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [repoRes, commitsRes] = await Promise.all([
      fetch(`/api/repos/${id}`),
      fetch(`/api/commits/${id}`),
    ])
    if (repoRes.ok) setRepo(await repoRes.json())
    if (commitsRes.ok) setCommits(await commitsRes.json())
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (session?.user.role === 'ADMIN') {
      fetch('/api/users').then((r) => { if (r.ok) r.json().then(setAllUsers) })
    }
  }, [session])

  // Auto-refresh when a push arrives for THIS repo
  useEffect(() => {
    function onPush(e: CustomEvent<PushEventDetail>) {
      if (e.detail.repoId === id) fetchData()
    }
    window.addEventListener(PUSH_EVENT, onPush as EventListener)
    return () => window.removeEventListener(PUSH_EVENT, onPush as EventListener)
  }, [id, fetchData])

  async function handleStatusChange(status: RepoStatus) {
    setStatusUpdating(true)
    const res = await fetch(`/api/repos/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setRepo(await res.json())
    setStatusUpdating(false)
  }

  async function handleAssign(userId: string, canEdit: boolean) {
    setAssignLoading(userId)
    const res = await fetch(`/api/repos/${id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, canView: true, canEdit }),
    })
    if (res.ok) setRepo(await res.json())
    setAssignLoading(null)
  }

  async function handleUnassign(userId: string) {
    setAssignLoading(userId)
    const res = await fetch(`/api/repos/${id}/assign`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) setRepo(await res.json())
    setAssignLoading(null)
  }

  async function handleSyncCommit(commitId: string, synced: boolean) {
    setSyncingId(commitId)
    try {
      const res = await fetch(`/api/commits/${id}/${commitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synced }),
      })
      if (!res.ok) return
      const { repoStatus }: { repoStatus: RepoStatus } = await res.json()
      setCommits((prev) =>
        prev.map((c) => (c._id === commitId ? { ...c, synced } : c))
      )
      if (repo && repoStatus !== repo.status) {
        setRepo({ ...repo, status: repoStatus })
      }
    } finally {
      setSyncingId(null)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${repo?.name}? This cannot be undone.`)) return
    const res = await fetch(`/api/repos/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/repos')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  if (!repo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">Repository not found or access denied.</p>
        <Link href="/repos" className="text-blue-400 hover:underline text-sm">
          Back to repositories
        </Link>
      </div>
    )
  }

  const isAdmin = session?.user.role === 'ADMIN'
  const permsMap = repo.permissions as Record<string, { canView: boolean; canEdit: boolean }>
  const canEdit =
    isAdmin || permsMap?.[session?.user.id ?? '']?.canEdit

  const assignedIds = (repo.assignedUsers as any[]).map((u) =>
    (u._id ?? u).toString()
  )
  const unassignedUsers = allUsers.filter((u) => !assignedIds.includes(u._id))
  const otherStatuses = ALL_STATUSES.filter((s) => s !== repo.status)

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/repos" className="text-gray-500 hover:text-gray-300 text-sm transition-colors shrink-0">
            ← Back
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{repo.name}</h1>
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 text-sm hover:text-blue-400 transition-colors"
            >
              {repo.url}
            </a>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-400 text-sm shrink-0 transition-colors"
          >
            Delete repo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Info card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wide">Info</h2>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Status</span>
              <StatusBadge status={repo.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Owner</span>
              <span className="text-gray-200">{repo.owner}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Last push</span>
              <span className="text-gray-200">
                {repo.lastPushAt ? new Date(repo.lastPushAt).toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Added</span>
              <span className="text-gray-200">
                {new Date(repo.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {canEdit && (
            <div className="pt-3 border-t border-gray-800">
              <p className="text-gray-500 text-xs mb-2">Change status to:</p>
              <div className="flex flex-wrap gap-1.5">
                {otherStatuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={statusUpdating}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors"
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Assigned users (admin only) */}
        {isAdmin && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4 lg:col-span-2">
            <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wide">
              Assigned Users ({assignedIds.length})
            </h2>

            {assignedIds.length === 0 ? (
              <p className="text-gray-600 text-sm">No users assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {(repo.assignedUsers as any[]).map((u) => {
                  const uid = (u._id ?? u).toString()
                  const perms = permsMap?.[uid] ?? {}
                  const isLoading = assignLoading === uid
                  return (
                    <div
                      key={uid}
                      className="flex items-center justify-between p-2.5 bg-gray-800/60 rounded-lg"
                    >
                      <div>
                        <p className="text-white text-sm">{u.name ?? 'Unknown'}</p>
                        <p className="text-gray-500 text-xs">
                          {perms.canView ? 'View' : ''}
                          {perms.canView && perms.canEdit ? ' · ' : ''}
                          {perms.canEdit ? 'Edit' : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 items-center">
                        {!perms.canEdit && (
                          <button
                            onClick={() => handleAssign(uid, true)}
                            disabled={isLoading}
                            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors"
                          >
                            Grant edit
                          </button>
                        )}
                        {perms.canEdit && (
                          <button
                            onClick={() => handleAssign(uid, false)}
                            disabled={isLoading}
                            className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 transition-colors"
                          >
                            Revoke edit
                          </button>
                        )}
                        <button
                          onClick={() => handleUnassign(uid)}
                          disabled={isLoading}
                          className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {unassignedUsers.length > 0 && (
              <div className="pt-3 border-t border-gray-800">
                <p className="text-gray-500 text-xs mb-2">Assign user:</p>
                <div className="space-y-1.5">
                  {unassignedUsers.map((u) => (
                    <div key={u._id} className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">{u.name}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAssign(u._id, false)}
                          disabled={assignLoading === u._id}
                          className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors disabled:opacity-40"
                        >
                          View only
                        </button>
                        <button
                          onClick={() => handleAssign(u._id, true)}
                          disabled={assignLoading === u._id}
                          className="text-xs px-3 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded transition-colors disabled:opacity-40"
                        >
                          View & Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unsynced pushes alert */}
      {commits.length > 0 && commits.some((c) => !c.synced) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 flex items-start gap-3">
          <span className="text-amber-400 text-xl leading-none shrink-0 mt-0.5">⚠</span>
          <div className="flex-1">
            <p className="text-amber-400 font-semibold text-sm">
              {commits.filter((c) => !c.synced).length} unsynced push
              {commits.filter((c) => !c.synced).length !== 1 ? 'es' : ''}
            </p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Mark each push as synced once you&apos;ve reviewed it. When all pushes are synced, the
              repository status will automatically update to&nbsp;
              <strong className="text-amber-400">Synced</strong>.
            </p>
            {canEdit && (
              <button
                onClick={async () => {
                  const unsynced = commits.filter((c) => !c.synced)
                  for (const c of unsynced) {
                    await handleSyncCommit(c._id, true)
                  }
                }}
                disabled={syncingId !== null}
                className="mt-2.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
              >
                Mark all as synced
              </button>
            )}
          </div>
        </div>
      )}

      {/* All synced banner */}
      {commits.length > 0 && commits.every((c) => c.synced) && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-3.5 flex items-center gap-3">
          <span className="text-emerald-400 text-lg leading-none shrink-0">✓</span>
          <p className="text-emerald-400 text-sm font-medium">
            All pushes are synced — repository status is{' '}
            <strong>Synced</strong>.
          </p>
        </div>
      )}

      {/* Commits */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-medium">
            Commits <span className="text-gray-600 text-sm font-normal">({commits.length})</span>
          </h2>
          {commits.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {commits.filter((c) => c.synced).length} synced
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {commits.filter((c) => !c.synced).length} unsynced
              </span>
            </div>
          )}
        </div>
        {commits.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-gray-600 text-sm">No commits recorded yet.</p>
            <p className="text-gray-700 text-xs mt-1">
              Set up a GitHub webhook pointing to{' '}
              <code className="text-gray-600">/api/webhook/github</code> to start receiving push events.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {commits.map((c) => {
              const isSyncing = syncingId === c._id
              return (
                <div
                  key={c._id}
                  className={`flex gap-4 px-5 py-3.5 ${!c.synced ? 'bg-amber-500/[0.03]' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{c.message}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {c.author} · <span className="text-gray-600">{c.branch}</span> ·{' '}
                      {new Date(c.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-gray-600 text-xs font-mono">
                      {c.commitId.slice(0, 7)}
                    </span>
                    {c.synced ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-emerald-400 text-xs">Synced</span>
                        {canEdit && (
                          <button
                            onClick={() => handleSyncCommit(c._id, false)}
                            disabled={isSyncing}
                            className="text-gray-600 hover:text-gray-400 text-xs ml-1 disabled:opacity-40 transition-colors"
                            title="Mark as unsynced"
                          >
                            ↩
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="text-amber-400 text-xs">Unsynced</span>
                        {canEdit && (
                          <button
                            onClick={() => handleSyncCommit(c._id, true)}
                            disabled={isSyncing}
                            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded ml-1 transition-colors disabled:opacity-40"
                          >
                            {isSyncing ? '…' : 'Sync'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
