// A separate API URL remains available for local development. Production uses
// the current origin so the React app and API can ship in one container.
const apiUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

// Paths are relative to the API root, for example request('/').
export async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}/${path.replace(/^\//, '')}`, options);
  if (response.status === 204) return null;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message ?? `API request failed (${response.status})`);
    error.code = body?.error?.code;
    error.status = response.status;
    throw error;
  }
  return body;
}
