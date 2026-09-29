import { redirect } from "next/navigation";

// Legacy duplicate of /nutricion (rendered the v2 view without the flag
// check); nothing links here anymore. Kept as a redirect for old bookmarks.
export default async function PlanDeComidasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  redirect(`/${slug}/nutricion`);
}
