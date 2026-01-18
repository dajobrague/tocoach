import { redirect } from "next/navigation";

import { getTrainerSession } from "@/lib/auth/session";

export default async function TrainerPage() {
  // Check if trainer is logged in
  const session = await getTrainerSession();

  if (session) {
    // Trainer is logged in, redirect to dashboard
    redirect("/trainer/dashboard");
  }

  // No session, redirect to login
  redirect("/trainer/login");
}
