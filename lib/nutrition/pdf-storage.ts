/**
 * Storage helpers for diet PDFs. Files live in the public `nutrition-pdfs`
 * bucket (shared with the legacy uploader). v2 uploads are namespaced under
 * `<trainer_id>/diet/<client_id>/…` so cleanup can be restricted to objects v2
 * itself wrote — legacy files are never deleted by v2 code.
 */

export const NUTRITION_PDFS_BUCKET = "nutrition-pdfs";
export const PDF_MAX_BYTES = 20 * 1024 * 1024;

const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${NUTRITION_PDFS_BUCKET}/`;

/** The bucket-relative path of a public URL from OUR Supabase project, or null. */
export function pdfStoragePathFromPublicUrl(pdfUrl: string): string | null {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (base === undefined || base.length === 0) {
      return null;
    }

    const url = new URL(pdfUrl);

    if (url.host !== new URL(base).host) {
      return null;
    }

    const idx = url.pathname.indexOf(PUBLIC_PATH_MARKER);

    if (idx === -1) {
      return null;
    }

    const path = url.pathname.slice(idx + PUBLIC_PATH_MARKER.length);

    return path.length > 0 ? decodeURIComponent(path) : null;
  } catch {
    return null;
  }
}

/** The v2 storage prefix for a trainer's diet PDFs. */
export function dietPdfPrefix(trainerId: string): string {
  return `${trainerId}/diet/`;
}

/** Safe segment for a storage path; keeps a recognizable name from the upload. */
export function sanitizeFilenameForStorage(name: string): string {
  const base = name.split(/[/\\]/).pop() || "documento.pdf";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);

  return cleaned.length > 0 ? cleaned : "documento.pdf";
}
