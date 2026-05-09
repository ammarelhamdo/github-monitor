// In-memory SSE client registry.
// Works for single-server deployments (npm start on a VPS).
// For multi-instance deployments, replace broadcast() with Redis pub/sub.

interface SSEClient {
  id: string
  send: (data: string) => void
}

declare global {
  // eslint-disable-next-line no-var
  var __sseClients: Map<string, SSEClient> | undefined
}

const clients: Map<string, SSEClient> = global.__sseClients ?? new Map()
global.__sseClients = clients

export function registerClient(client: SSEClient): () => void {
  clients.set(client.id, client)
  return () => clients.delete(client.id)
}

export function broadcast(event: string, data: unknown): number {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  let sent = 0
  for (const [id, client] of clients) {
    try {
      client.send(message)
      sent++
    } catch {
      clients.delete(id)
    }
  }
  return sent
}
