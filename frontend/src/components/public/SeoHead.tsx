import { useEffect } from "react";

import { trackPageView } from "@/features/public/analytics";
import { persistAttributionFromLocation } from "@/features/public/attribution";

type SeoHeadProps = {
  title: string;
  description: string;
  path?: string;
  type?: "website" | "article";
  image?: string | null;
  robots?: string;
  keywords?: string[];
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  trackAs?: string;
};

const DEFAULT_SITE_NAME = "R.LUMINUOUS | HotelMS";

function getBaseUrl(): string {
  const envBase = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (envBase) return envBase.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  return "http://localhost:5173";
}

function upsertMeta(
  attributeName: "name" | "property",
  attributeValue: string,
  content: string,
): void {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attributeName}="${attributeValue}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertLink(rel: string, href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function buildAbsoluteUrl(path: string): string {
  return new URL(path, `${getBaseUrl()}/`).toString();
}

export default function SeoHead({
  title,
  description,
  path,
  type = "website",
  image,
  robots = "index, follow",
  keywords = [],
  jsonLd,
  trackAs,
}: SeoHeadProps) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const resolvedPath =
      path ??
      (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/");
    const canonicalUrl = buildAbsoluteUrl(resolvedPath);
    const fullTitle = `${title} | ${DEFAULT_SITE_NAME}`;

    document.title = fullTitle;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", robots);
    upsertMeta("name", "keywords", keywords.join(", "));
    upsertMeta("property", "og:site_name", DEFAULT_SITE_NAME);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    if (image) {
      upsertMeta("property", "og:image", image);
      upsertMeta("name", "twitter:image", image);
    }
    upsertLink("canonical", canonicalUrl);

    const existingJsonLd = document.getElementById("seo-json-ld");
    if (existingJsonLd) {
      existingJsonLd.remove();
    }
    if (jsonLd) {
      const script = document.createElement("script");
      script.id = "seo-json-ld";
      script.type = "application/ld+json";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    if (typeof window !== "undefined") {
      persistAttributionFromLocation(window.location.search);
      trackPageView({
        page_type: trackAs ?? type,
        page_title: title,
        page_path: resolvedPath,
      });
    }
  }, [description, image, jsonLd, keywords, path, robots, title, trackAs, type]);

  return null;
}
