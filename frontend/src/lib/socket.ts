import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
const WS_NAMESPACE = import.meta.env.VITE_WS_NAMESPACE || '/discussion';

export function createSocketConnection(token: string): Socket {
  return io(`${WS_URL}${WS_NAMESPACE}`, {
    auth: {
      token,
    },
    withCredentials: true,
    autoConnect: false,
  });
}

export function disconnectSocket(socket: Socket | null): void {
  if (socket) {
    socket.disconnect();
  }
}

