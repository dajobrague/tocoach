import { programFolderHandlers } from "@/lib/training/program-folders";

// GET /api/program-folders — the tenant's template folder hierarchy (flat
// rows; the client builds the tree). POST creates a folder, optionally nested.
export const { GET, POST } = programFolderHandlers;
