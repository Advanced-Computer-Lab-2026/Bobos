export class ApiError extends Error {
  constructor(message, status, path, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.data = data;
  }
}

export async function api(path, { token, method = "GET", body, signal, responseType = "json" } = {}) {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("The API could not be reached. Check that the backend is running.", 0, path);
  }

  if (responseType === "blob") {
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(data?.message || `Request failed (${response.status}).`, response.status, path, data);
    }
    return { data: await response.blob(), response };
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.message || `Request failed (${response.status}).`, response.status, path, data);
  }
  return data;
}

export function explainApiError(error, feature) {
  if (error?.status === 404) {
    return `${feature} is not available on the current Development backend yet (${error.path}).`;
  }
  return error?.message || "Something went wrong. Please try again.";
}
