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

// Requirement 49 - authenticated binary download (e.g. the schedule PDF).
// Resolves to { blob, fileName } using the server's Content-Disposition name;
// a non-2xx JSON body becomes an ApiError with the server's message.
export async function download(path, { token, fallbackName = 'download' } = {}) {
  const headers = { Accept: 'application/pdf, application/json' };
  const auth = token || getToken();
  if (auth) headers.Authorization = `Bearer ${auth}`;

  let response;
  try {
    response = await fetch(`/api${path}`, { headers });
  } catch (err) {
    throw new ApiError('Cannot reach the server. Is it running on port 4000?', 0);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = JSON.parse(await response.text());
      if (data && data.message) message = data.message;
    } catch (err) {
      // non-JSON error body: keep the generic message
    }
    throw new ApiError(message, response.status);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const fileName = match ? decodeURIComponent(match[1].trim()) : fallbackName;
  return { blob: await response.blob(), fileName };
}

export const TOKEN_STORAGE_KEY = TOKEN_KEY;
