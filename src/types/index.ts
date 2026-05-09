export type UserRole = 'ADMIN' | 'EMPLOYEE'
export type RepoStatus = 'NOT_REVIEWED' | 'SYNCED' | 'FOLLOWING'

export interface IUser {
  _id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
}

export interface IPermissions {
  canView: boolean
  canEdit: boolean
}

export interface IRepository {
  _id: string
  name: string
  owner: string
  repo: string
  url: string
  status: RepoStatus
  assignedUsers: (IUser | string)[]
  permissions: Record<string, IPermissions>
  lastPushAt: string | null
  createdAt: string
}

export interface ICommit {
  _id: string
  repoId: string
  message: string
  author: string
  branch: string
  commitId: string
  timestamp: string
  synced: boolean
  syncedAt: string | null
  syncedBy: string | null
}
