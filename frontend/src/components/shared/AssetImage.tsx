import { useEffect, useState } from "react";

import { toAssetUrl } from "@/lib/assets";

interface AssetImageProps {
  path: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: string;
}

export default function AssetImage({
  path,
  alt,
  className,
  fallback = "No image available",
}: AssetImageProps) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const src = toAssetUrl(path);
  const canRenderImage = Boolean(src && path !== failedPath);

  useEffect(() => {
    setFailedPath(null);
  }, [path]);

  if (!canRenderImage) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailedPath(path ?? null)}
    />
  );
}
