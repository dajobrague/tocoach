"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Legacy route. The checkins template editor now lives at
 * /trainer/settings/forms/checkins which covers auto-apply toggle, default
 * schedule and questions config in a single place. Redirect so old
 * bookmarks/links keep working.
 */
export default function CheckinDefaultsLegacyRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/trainer/settings/forms/checkins");
  }, [router]);

  return null;
}
