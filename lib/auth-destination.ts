export type DestinationParams = Record<string, string | string[] | undefined>;

export function loginDestination(path: "/submit" | "/admin", params: DestinationParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.append(key, value);
    if (Array.isArray(value)) for (const item of value) query.append(key, item);
  }

  const next = query.size ? path + "?" + query.toString() : path;
  return "/login?" + new URLSearchParams({ tab: "login", next });
}

export function afterLoginDestination(next: string | null) {
  return next && /^\/(submit|admin)(\?[^#\r\n]*)?$/.test(next) ? next : "/";
}
