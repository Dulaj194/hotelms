import { useEffect, useState, type ReactNode } from "react";

import { toAssetUrl } from "@/lib/assets";

type SafeMenuAssetProps = {
  path: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallback: ReactNode;
  loading?: "eager" | "lazy";
};

export default function SafeMenuAsset({
  path,
  alt,
  className,
  fallbackClassName,
  fallback,
  loading = "lazy",
}: SafeMenuAssetProps) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const src = toAssetUrl(path);
  const canRenderImage = Boolean(src && path !== failedPath);

  useEffect(() => {
    setFailedPath(null);
  }, [path]);

  if (!canRenderImage) {
    return <div className={fallbackClassName}>{fallback}</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      onError={() => setFailedPath(path ?? null)}
    />
  );
}
