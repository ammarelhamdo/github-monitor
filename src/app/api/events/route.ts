import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { registerClient } from '@/lib/sse'

// Force dynamic so Next.js never caches this streaming response
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()
  let unregister: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const id = crypto.randomUUID()

      unregister = registerClient({
        id,
        send: (data: string) => controller.enqueue(encoder.encode(data)),
      })

      // Confirm connection
      controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'))

      // Keep-alive ping every 25 s (browsers close idle SSE after ~30 s)
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          if (heartbeat) clearInterval(heartbeat)
          unregister?.()
        }
      }, 25_000)
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      unregister?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable buffering in nginx / reverse proxies
      'X-Accel-Buffering': 'no',
    },
  })
}
