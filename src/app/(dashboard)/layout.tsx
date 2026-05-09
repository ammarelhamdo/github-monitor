import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import RealtimeProvider from '@/components/providers/RealtimeProvider'
import ToastContainer from '@/components/ui/ToastContainer'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-gray-100">
      <Sidebar role={session.user.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={session.user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      {/* Real-time: SSE connection + browser notifications */}
      <RealtimeProvider />

      {/* In-app toast stack */}
      <ToastContainer />
    </div>
  )
}
