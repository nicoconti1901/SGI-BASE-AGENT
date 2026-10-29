import { redirect } from "next/navigation";

/** El tablero llega en el slice 18.3; por ahora la entrada del módulo es la carga de km. */
export default async function RoadSafetyHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/t/${slug}/road-safety/km`);
}
