'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export const PUSH_EVENT = 'repomon:push' as const
export const STATUS_EVENT = 'repomon:status' as const

export interface PushEventDetail {
  repoId: string
  repoName: string
  branch: string
  author: string
  message: string
}

export interface StatusEventDetail {
  repoId: string
  status: string
}

declare global {
  interface WindowEventMap {
    [PUSH_EVENT]: CustomEvent<PushEventDetail>
    [STATUS_EVENT]: CustomEvent<StatusEventDetail>
    'repomon:toast': CustomEvent<{ title: string; body: string }>
  }
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.35)
    osc.onended = () => ctx.close()
  } catch {
    // AudioContext not available (e.g., headless environments)
  }
}

export default function RealtimeProvider() {
  const { data: session } = useSession()
  const router = useRouter()
  const notifPerm = useRef<NotificationPermission>('default')

  // Ask for browser notification permission once
  useEffect(() => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      notifPerm.current = 'granted'
      return
    }
    if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((p) => {
        notifPerm.current = p
      })
    }
  }, [])

  useEffect(() => {
    if (!session) return

    const es = new EventSource('/api/events')

    es.addEventListener('push', (e: MessageEvent) => {
      const data: PushEventDetail = JSON.parse(e.data)

      // Audible alert
      playNotificationSound()

      // Refresh Next.js server component cache (dashboard stats etc.)
      router.refresh()

      // Let client components (repos list, repo detail) react immediately
      window.dispatchEvent(new CustomEvent(PUSH_EVENT, { detail: data }))

      // In-app toast
      window.dispatchEvent(
        new CustomEvent('repomon:toast', {
          detail: {
            title: `New push · ${data.repoName}`,
            body: `${data.author} → ${data.branch}: ${data.message.slice(0, 72)}`,
          },
        })
      )

      // Browser notification (works even when tab is in background)
      if (notifPerm.current === 'granted') {
        new Notification(`New push to ${data.repoName}`, {
          body: `${data.author} pushed to ${data.branch}\n${data.message.slice(0, 100)}`,
          icon: '/favicon.ico',
          tag: `push-${data.repoId}`,
          silent: false,
        })
      }
    })

    es.addEventListener('status', (e: MessageEvent) => {
      const data: StatusEventDetail = JSON.parse(e.data)
      window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: data }))
    })

    es.onerror = () => {
      // EventSource auto-reconnects — no manual handling needed
    }

    return () => es.close()
  }, [session, router])

  return null
}
