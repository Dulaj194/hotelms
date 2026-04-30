export const ALLOWED_LOGO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ACCEPTED_LOGO_INPUT = ALLOWED_LOGO_MIME_TYPES.join(",");
export const MAX_LOGO_SIZE_MB = 5;

export function validateLogoFile(file: File): string | null {
  if (!ALLOWED_LOGO_MIME_TYPES.includes(file.type as (typeof ALLOWED_LOGO_MIME_TYPES)[number])) {
    return "Logo must be JPG, PNG, WebP, or GIF.";
  }

  if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
    return `Logo size must be less than ${MAX_LOGO_SIZE_MB} MB.`;
  }

  return null;
}