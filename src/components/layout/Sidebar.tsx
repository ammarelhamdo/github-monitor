'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: string
}

const baseNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { href: '/repos', label: 'Repositories', icon: '⬢' },
]

const adminNav: NavItem[] = [
  { href: '/admin/users', label: 'Users', icon: '◈' },
]

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()
  const nav = role === 'ADMIN' ? [...baseNav, ...adminNav] : baseNav

  return (
    <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
            R
          </div>
          <span className="text-white font-semibold text-sm">RepoMonitor</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map((item) => {
          const active =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-5 py-4 border-t border-gray-800">
        <p className="text-gray-600 text-xs">
          {role === 'ADMIN' ? '🔑 Administrator' : '👤 Employee'}
        </p>
      </div>
    </aside>
  )
}
