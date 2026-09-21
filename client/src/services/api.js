const apiUrl = import.meta.env.VITE_API_URL;

// Paths are relative to the API root, for example request('/').
export async function request(path, options = {}) {
  if (!apiUrl) throw new Error('VITE_API_URL is required');
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, options);
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
