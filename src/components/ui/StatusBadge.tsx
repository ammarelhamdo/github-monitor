import { RepoStatus } from '@/types'

const styles: Record<RepoStatus, string> = {
  NOT_REVIEWED: 'bg-red-500/15 text-red-400 border border-red-500/30',
  SYNCED: 'bg-green-500/15 text-green-400 border border-green-500/30',
  FOLLOWING: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
}

const labels: Record<RepoStatus, string> = {
  NOT_REVIEWED: 'Not Reviewed',
  SYNCED: 'Synced',
  FOLLOWING: 'Following',
}

const dots: Record<RepoStatus, string> = {
  NOT_REVIEWED: 'bg-red-400',
  SYNCED: 'bg-green-400',
  FOLLOWING: 'bg-blue-400',
}

export default function StatusBadge({ status }: { status: RepoStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {labels[status]}
    </span>
  )
}
