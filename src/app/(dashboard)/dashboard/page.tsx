'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import { PUSH_EVENT, STATUS_EVENT } from '@/components/providers/RealtimeProvider'
import { IRepository, RepoStatus } from '@/types'
import type { ActivityItem } from '@/app/api/activity/route'

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS_LABELS: Record<RepoStatus, string> = {
  NOT_REVIEWED: 'Not Reviewed',
  SYNCED: 'Synced',
  FOLLOWING: 'Following',
}

export default function DashboardPage() {
  const { data: session } = useSession()

  const [repos, setRepos] = useState<IRepository[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [userCount, setUserCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<RepoStatus | ''>('')

  const fetchAll = useCallback(async () => {
    const [reposRes, activityRes] = await Promise.all([
      fetch('/api/repos'),
      fetch('/api/activity'),
    ])
    if (reposRes.ok) setRepos(await reposRes.json())
    if (activityRes.ok) setActivity(await activityRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (session?.user.role === 'ADMIN') {
      fetch('/api/users').then((r) => {
        if (r.ok) r.json().then((u) => setUserCount(u.length))
      })
    }
  }, [session])

  // Refresh on new push or on another user triggering an auto-sync
  useEffect(() => {
    const handler = () => fetchAll()
    window.addEventListener(PUSH_EVENT, handler)
    window.addEventListener(STATUS_EVENT, handler)
    return () => {
      window.removeEventListener(PUSH_EVENT, handler)
      window.removeEventListener(STATUS_EVENT, handler)
    }
  }, [fetchAll])

  async function handleSyncToggle(item: ActivityItem, synced: boolean) {
    setSyncingId(item.id)
    try {
      const res = await fetch(`/api/commits/${item.repoId}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synced }),
      })
      if (!res.ok) return
      const { repoStatus }: { repoStatus: RepoStatus } = await res.json()

      // Update this activity item's synced flag
      setActivity((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, synced } : a))
      )

      // If repo status changed (auto-SYNCED or reverted), reflect in repos list
      setRepos((prev) =>
        prev.map((r) => (r._id === item.repoId ? { ...r, status: repoStatus } : r))
      )
    } finally {
      setSyncingId(null)
    }
  }

  function canEdit(repoId: string): boolean {
    if (session?.user.role === 'ADMIN') return true
    const repo = repos.find((r) => r._id === repoId)
    return repo?.permissions?.[session?.user.id ?? '']?.canEdit ?? false
  }

  const stats = {
    total: repos.length,
    notReviewed: repos.filter((r) => r.status === 'NOT_REVIEWED').length,
    synced: repos.filter((r) => r.status === 'SYNCED').length,
    following: repos.filter((r) => r.status === 'FOLLOWING').length,
  }

  const filteredRepos = repos.filter((r) => {
    const matchSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.owner?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || r.status === statusFilter
    return matchSearch && matchStatus
  })

  const pushActivity = activity.filter((a) => a.type === 'push')
  const reposAdded = activity.filter((a) => a.type === 'repo_added')

  return (
    <div className="space-y-6 max-w-[1400px]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-gray-500 text-sm">Welcome back, {session?.user.name}</p>
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              live
            </span>
          </div>
        </div>
        {session?.user.role === 'ADMIN' && (
          <Link
            href="/repos"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Repository
          </Link>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[
          { label: 'Total Repos', value: stats.total, color: 'text-white', extra: '' },
          {
            label: 'Not Reviewed',
            value: stats.notReviewed,
            color: 'text-red-400',
            extra: stats.notReviewed > 0 ? 'border-red-500/40 bg-red-500/5' : '',
          },
          { label: 'Synced', value: stats.synced, color: 'text-emerald-400', extra: '' },
          { label: 'Following', value: stats.following, color: 'text-blue-400', extra: '' },
          ...(session?.user.role === 'ADMIN' && userCount !== null
            ? [{ label: 'Users', value: userCount, color: 'text-purple-400', extra: '' }]
            : []),
        ].map((s) => (
          <div
            key={s.label}
            className={`bg-gray-900 border rounded-xl p-4 ${s.extra || 'border-gray-800'}`}
          >
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>
              {loading ? <span className="text-gray-700">—</span> : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Recent Pushes + Repos Added ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Recent Pushes table — per-push sync tracking */}
        <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-xl flex flex-col min-h-0">
          <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <h2 className="text-white font-semibold text-sm">Recent Pushes</h2>
            {!loading && (
              <span className="text-gray-600 text-xs ml-0.5">({pushActivity.length})</span>
            )}
            {!loading && pushActivity.some((a) => !a.synced) && (
              <span className="ml-auto text-xs text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-full">
                {pushActivity.filter((a) => !a.synced).length} unsynced
              </span>
            )}
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr className="border-b border-gray-800">
                  {['Repository', 'Branch', 'Author', 'Message', 'Sync', 'When'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-gray-500 text-xs font-medium uppercase tracking-wide px-5 py-2.5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-600 py-12 text-sm">
                      Loading…
                    </td>
                  </tr>
                ) : pushActivity.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <p className="text-gray-600 text-sm">No pushes recorded yet.</p>
                      <p className="text-gray-700 text-xs mt-1">
                        Configure a GitHub webhook pointing to{' '}
                        <code className="text-gray-600">/api/webhook/github</code>
                      </p>
                    </td>
                  </tr>
                ) : (
                  pushActivity.slice(0, 20).map((item) => {
                    const isSyncing = syncingId === item.id
                    const editable = canEdit(item.repoId)
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-800/40 transition-colors ${
                          !item.synced ? 'bg-amber-500/[0.03]' : ''
                        }`}
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/repos/${item.repoId}`}
                            className="text-white text-sm font-medium hover:text-blue-400 transition-colors"
                          >
                            {item.repoName}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-blue-400/90 text-xs font-mono bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                            {item.branch}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-sm whitespace-nowrap">
                          {item.author}
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                          {item.message}
                        </td>
                        <td className="px-5 py-3">
                          {item.synced ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="text-emerald-400 text-xs font-medium">Synced</span>
                              {editable && (
                                <button
                                  onClick={() => handleSyncToggle(item, false)}
                                  disabled={isSyncing}
                                  className="ml-1 text-gray-600 hover:text-gray-400 text-xs disabled:opacity-40 transition-colors"
                                  title="Mark as unsynced"
                                >
                                  ↩
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span className="text-amber-400 text-xs font-medium">Unsynced</span>
                              {editable && (
                                <button
                                  onClick={() => handleSyncToggle(item, true)}
                                  disabled={isSyncing}
                                  className="ml-1 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded transition-colors disabled:opacity-40"
                                >
                                  {isSyncing ? '…' : 'Mark synced'}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {timeAgo(item.timestamp)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Repos Added panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col min-h-0">
          <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <h2 className="text-white font-semibold text-sm">Repos Added</h2>
            {!loading && (
              <span className="text-gray-600 text-xs ml-0.5">({reposAdded.length})</span>
            )}
          </div>
          <div className="overflow-auto flex-1 divide-y divide-gray-800">
            {loading ? (
              <div className="text-center text-gray-600 py-12 text-sm">Loading…</div>
            ) : reposAdded.length === 0 ? (
              <div className="text-center text-gray-600 py-12 text-sm">
                No repositories added yet.
              </div>
            ) : (
              reposAdded.map((item) => (
                <Link
                  key={item.id}
                  href={`/repos/${item.repoId}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-base shrink-0">
                    +
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.repoName}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{timeAgo(item.timestamp)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Repositories table ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-800 flex-wrap">
          <div className="flex items-center gap-2.5 mr-auto">
            <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
            <span className="text-white font-semibold text-sm">
              Repositories
              {!loading && (
                <span className="text-gray-600 font-normal ml-1.5">
                  ({filteredRepos.length}
                  {filteredRepos.length !== repos.length ? ` of ${repos.length}` : ''})
                </span>
              )}
            </span>
          </div>

          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm w-44 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RepoStatus | '')}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABELS) as RepoStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>

          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              className="text-xs text-gray-500 hover:text-white border border-gray-700 rounded-full px-2.5 py-0.5 transition-colors"
            >
              Clear ×
            </button>
          )}
        </div>

        <div className="overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-900 z-10">
              <tr className="border-b border-gray-800">
                {['Repository', 'Status', 'Last Push', 'Assigned', ''].map((h) => (
                  <th
                    key={h}
                    className={`text-left text-gray-500 text-xs font-medium uppercase tracking-wide px-5 py-2.5 ${
                      h === 'Assigned' ? 'hidden lg:table-cell' : ''
                    } ${h === 'Last Push' ? 'hidden md:table-cell' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-600 py-12 text-sm">
                    Loading…
                  </td>
                </tr>
              ) : filteredRepos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-600 py-12 text-sm">
                    {repos.length === 0
                      ? 'No repositories tracked yet.'
                      : 'No repositories match your filters.'}
                  </td>
                </tr>
              ) : (
                filteredRepos.map((repo) => (
                  <tr
                    key={repo._id}
                    className="hover:bg-gray-800/40 transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-white text-sm font-medium">{repo.name}</p>
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-600 text-xs hover:text-blue-400 transition-colors"
                      >
                        {repo.owner}/{repo.repo ?? repo.name.split('/')[1]}
                      </a>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={repo.status} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-sm hidden md:table-cell">
                      {repo.lastPushAt ? timeAgo(repo.lastPushAt) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-sm hidden lg:table-cell">
                      {(repo.assignedUsers as unknown[]).length} users
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/repos/${repo._id}`}
                        className="text-blue-400 hover:text-blue-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
