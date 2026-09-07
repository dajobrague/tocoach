// GET /api/library-tags?kind= — the tenant's tag registry for one library.
// POST creates a tag (or returns the existing one of that name).
export { GET, POST } from "@/lib/library/tag-routes";
