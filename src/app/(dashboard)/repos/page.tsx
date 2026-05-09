'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import AddRepoModal from '@/components/repos/AddRepoModal'
import { IRepository, RepoStatus } from '@/types'
import { PUSH_EVENT } from '@/components/providers/RealtimeProvider'

export default function ReposPage() {
  const { data: session } = useSession()
  const [repos, setRepos] = useState<IRepository[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<RepoStatus | ''>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [lastPush, setLastPush] = useState<string | null>(null)

  const fetchRepos = useCallback(async () => {
    const res = await fetch('/api/repos')
    if (res.ok) setRepos(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRepos()
  }, [fetchRepos])

  // Live refresh when a push arrives via SSE
  useEffect(() => {
    function onPush(e: CustomEvent<{ repoName: string }>) {
      setLastPush(e.detail.repoName)
      fetchRepos()
    }
    window.addEventListener(PUSH_EVENT, onPush as EventListener)
    return () => window.removeEventListener(PUSH_EVENT, onPush as EventListener)
  }, [fetchRepos])

  const filtered = repos.filter((r) => {
    const matchSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.owner.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || r.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Repositories</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-gray-500 text-sm">{repos.length} tracked</p>
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              live
            </span>
            {lastPush && (
              <span className="text-xs text-blue-400">· updated {lastPush}</span>
            )}
          </div>
        </div>
        {session?.user.role === 'ADMIN' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Repository
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search repositories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-4 py-2 text-sm flex-1 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RepoStatus | '')}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
        >
          <option value="">All Statuses</option>
          <option value="NOT_REVIEWED">Not Reviewed</option>
          <option value="SYNCED">Synced</option>
          <option value="FOLLOWING">Following</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-500 text-xs font-medium uppercase tracking-wide px-5 py-3">
                Repository
              </th>
              <th className="text-left text-gray-500 text-xs font-medium uppercase tracking-wide px-5 py-3">
                Status
              </th>
              <th className="text-left text-gray-500 text-xs font-medium uppercase tracking-wide px-5 py-3 hidden md:table-cell">
                Last Push
              </th>
              <th className="text-left text-gray-500 text-xs font-medium uppercase tracking-wide px-5 py-3 hidden lg:table-cell">
                Assigned
              </th>
              <th className="px-5 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-600 py-12">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-600 py-12">
                  {repos.length === 0 ? 'No repositories tracked yet.' : 'No results match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((repo) => (
                <tr key={repo._id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-white text-sm font-medium">{repo.name}</p>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 text-xs hover:text-blue-400 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {repo.url}
                    </a>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={repo.status} />
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm hidden md:table-cell">
                    {repo.lastPushAt ? new Date(repo.lastPushAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm hidden lg:table-cell">
                    {(repo.assignedUsers as any[]).length} users
                  </td>
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/repos/${repo._id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <AddRepoModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            fetchRepos()
          }}
        />
      )}
    </div>
  )
}
