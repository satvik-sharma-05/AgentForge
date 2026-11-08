// Backend origin: empty in dev (Vite proxies /api), set VITE_API_URL in production (e.g. https://agentforge-api.onrender.com)
export const BASE = ((import.meta as any).env?.VITE_API_URL || "").replace(/\/$/, "");
const H = () => ({ Authorization: "Bearer " + (localStorage.getItem("t") || "") });

export async function api(path: string, method = "GET", body?: any) {
  const form = body instanceof FormData;
  const r = await fetch(BASE + "/api/v1" + path, {
    method, headers: { ...H(), ...(form || !body ? {} : { "Content-Type": "application/json" }) },
    body: form ? body : body && JSON.stringify(body),
  });
  if (r.status === 401 && !path.startsWith("/auth")) { localStorage.removeItem("t"); location.reload(); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || r.statusText);
  return j;
}

// POST and read Server-Sent Events
export async function stream(path: string, body: any, on: (e: any) => void, signal?: AbortSignal) {
  const r = await fetch(BASE + "/api/v1" + path, {
    method: "POST", signal, headers: { ...H(), "Content-Type": "application/json" }, body: JSON.stringify(body || {}),
  });
  if (!r.ok) return on({ type: "error", error: (await r.json().catch(() => ({}))).detail || r.statusText });
  const rd = r.body!.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n"); buf = parts.pop()!;
    parts.forEach((p) => p.startsWith("data: ") && on(JSON.parse(p.slice(6))));
  }
}
