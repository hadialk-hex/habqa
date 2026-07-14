import { io, type Socket } from "socket.io-client";

// Opens a Socket.io connection to the same origin. The /socket.io path is
// proxied to the backend by a dedicated Next.js rewrite, which keeps us within
// the CSP connect-src policy and needs no separate public backend URL. HTTP
// long-polling is used (not a raw WebSocket) because Next.js rewrites proxy
// HTTP but not the WS upgrade handshake — polling still delivers messages in
// well under a second, which is what an inbox needs. The JWT from localStorage
// authenticates the handshake; the backend gateway joins the tenant's room.
export function createSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  if (!token) return null;
  return io(window.location.origin, {
    path: "/socket.io",
    // Match the server: request exactly "/socket.io?…" with no trailing
    // slash, so the same-origin rewrite forwards the path untouched.
    addTrailingSlash: false,
    auth: { token },
    transports: ["polling"],
    upgrade: false,
    reconnectionAttempts: 10,
  });
}
