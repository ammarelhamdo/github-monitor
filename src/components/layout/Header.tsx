'use client'
import { signOut } from 'next-auth/react'

interface HeaderProps {
  user: {
    name?: string | null
    email?: string | null
    role: string
  }
}

export default function Header({ user }: HeaderProps) {
  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 px-6 flex items-center justify-between shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-gray-200 text-sm font-medium leading-none">{user.name}</p>
          <p className="text-gray-500 text-xs mt-0.5">{user.email}</p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            user.role === 'ADMIN'
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-gray-700 text-gray-400'
          }`}
        >
          {user.role}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-gray-500 hover:text-gray-200 text-sm transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
