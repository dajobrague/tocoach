import { redirect } from "next/navigation";

/** `/mas` quedó huérfana (el menú vive en el avatar); enlaces viejos → perfil. */
export default async function MasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  redirect(`/${slug}/profile`);
}
