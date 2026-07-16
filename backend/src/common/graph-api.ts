// Centralized Facebook Graph API version used across the entire platform.
// When Meta deprecates a version, update only this constant.
// Latest stable: https://developers.facebook.com/docs/graph-api/changelog
// Version history:
//   v25.0 — Feb 18, 2026 (CURRENT)
//   v24.0 — Oct 8, 2025
//   v23.0 — May 29, 2025 (expired June 2026)
//   v22.0 — Jan 21, 2025 (expired)
//   v21.0 — Oct 2, 2024  (expired)
export const GRAPH_API_VERSION = 'v25.0';
export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
