// Tiny fetch wrapper. It reads the JWT that AuthContext stores in localStorage
// and turns a non-2xx response into an Error carrying the server's own message,
// so pages can show the exact rule that was violated (unpublished group, full
// slot, timetable clash...).
const TOKEN_KEY = 'bobos.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (err) {
    return null;
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const auth = token || getToken();
  if (auth) headers.Authorization = `Bearer ${auth}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (err) {
    throw new ApiError('Cannot reach the server. Is it running on port 4000?', 0);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = null;
    }
  }

  if (!response.ok) {
    const message = (data && data.message) || `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return data;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' })
};

export const TOKEN_STORAGE_KEY = TOKEN_KEY;
