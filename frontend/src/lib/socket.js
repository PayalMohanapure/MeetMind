import { SOCKET_URL, SOCKET_PATH, USE_MOCK } from '@/config/env';
import { session } from './session';

let socket = null;

/** One socket per tab. In mock mode returns a simulated room socket. */
export async function getSocket() {
  if (socket) return socket;
  if (USE_MOCK) {
    const { createMockSocket } = await import('@/mock/socket');
    socket = createMockSocket();
    return socket;
  }
  const { io } = await import('socket.io-client');
  socket = io(SOCKET_URL || undefined, {
    path: SOCKET_PATH,
    transports: ['websocket', 'polling'],
    autoConnect: true,
    auth: (cb) => cb({ token: session.token }),
    reconnectionDelayMax: 8000,
  });
  return socket;
}

export function closeSocket() {
  if (socket) { socket.removeAllListeners?.(); socket.disconnect?.(); socket = null; }
}
