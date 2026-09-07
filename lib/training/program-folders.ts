import { NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { createFolderRouteHandlers } from "@/lib/library/folder-routes";
import { FolderService } from "@/lib/library/folder-service";

/**
 * /api/program-folders handlers: hierarchy in `program_folders`, membership
 * on `programs.tags` (a folder IS a tag). Trainer auth only — no feature
 * flag, unlike recipes.
 */
export const programFolderHandlers = createFolderRouteHandlers({
  guard: async () => {
    const session = await getTrainerSession();

    if (session === null) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: "No autorizado" },
          { status: 401 }
        ),
      };
    }

    return { ok: true, tenantHost: session.tenant_host };
  },
  createService: () =>
    new FolderService(createSupabaseClient(), {
      table: "program_folders",
      retagRpc: "replace_program_tag",
    }),
  logTag: "[ProgramFolders]",
});
