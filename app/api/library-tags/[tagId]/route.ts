// PATCH /api/library-tags/[tagId] — rename (registry + every item).
// DELETE removes the tag from the registry and from every item.
export { DELETE, PATCH } from "@/lib/library/tag-routes";
