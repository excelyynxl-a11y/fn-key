const apiUrl = import.meta.env.VITE_API_URL;

// Paths are relative to the API root, for example request('/').
export async function request(path, options = {}) {
  if (!apiUrl) throw new Error('VITE_API_URL is required');
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, options);
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}
