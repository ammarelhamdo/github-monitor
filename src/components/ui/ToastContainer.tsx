'use client'
import { useState, useEffect } from 'react'

interface Toast {
  id: string
  title: string
  body: string
  exiting: boolean
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    function handleToast(e: CustomEvent<{ title: string; body: string }>) {
      const id = crypto.randomUUID()

      setToasts((prev) => [...prev.slice(-4), { id, ...e.detail, exiting: false }])

      // Start exit animation after 4.5 s, remove after 5 s
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
        )
      }, 4_500)
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 5_000)
    }

    window.addEventListener('repomon:toast', handleToast as EventListener)
    return () => window.removeEventListener('repomon:toast', handleToast as EventListener)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            transition: 'opacity 0.4s, transform 0.4s',
            opacity: toast.exiting ? 0 : 1,
            transform: toast.exiting ? 'translateX(12px)' : 'translateX(0)',
          }}
          className="pointer-events-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 flex items-start gap-3 max-w-xs w-full"
        >
          {/* Animated dot */}
          <span className="mt-1 shrink-0 relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium leading-snug">{toast.title}</p>
            <p className="text-gray-400 text-xs mt-0.5 leading-snug line-clamp-2">{toast.body}</p>
          </div>

          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="text-gray-600 hover:text-gray-400 text-base leading-none shrink-0 transition-colors"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
