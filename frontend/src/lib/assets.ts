import { RESOLVED_BACKEND_ORIGIN } from "@/lib/networkBase";

export function toAssetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${RESOLVED_BACKEND_ORIGIN}${path}`;
}