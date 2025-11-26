import { redirect } from "next/navigation";

export default function Home() {
  // Redirect directly to trainer login
  redirect("/trainer/login");
}
