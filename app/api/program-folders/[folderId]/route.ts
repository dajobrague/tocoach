import { programFolderHandlers } from "@/lib/training/program-folders";

// PATCH /api/program-folders/[folderId] — rename (bulk-retags templates)
// and/or move (parent_id; null = root, cycles rejected). DELETE removes the
// folder only: children float to the root and templates keep the tag.
export const { PATCH, DELETE } = programFolderHandlers;
