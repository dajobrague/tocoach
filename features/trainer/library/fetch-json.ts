// `{ success, data, error }` envelope helpers shared by the library hooks.

export async function readEnvelope<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (response.ok === false || data?.success !== true) {
    throw new Error(data?.error ?? "Error de red");
  }

  return data.data as T;
}

export function getJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "same-origin", cache: "no-store" }).then(
    readEnvelope<T>
  );
}

export function sendJson<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>
): Promise<T> {
  return fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }).then(readEnvelope<T>);
}
