import { NextResponse } from "next/server";

/** Legacy Supabase magic-link endpoint — replaced by OTP flow. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use /api/auth/client-forgot-password",
      deprecated: true,
    },
    { status: 410 }
  );
}
