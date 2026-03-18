const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

export function toAssetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_ORIGIN}${path}`;
}