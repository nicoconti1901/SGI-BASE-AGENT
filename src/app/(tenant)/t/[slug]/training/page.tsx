import { redirect } from "next/navigation";

// El resumen por sede y la matriz de cumplimiento llegan en los próximos pasos del módulo;
// mientras tanto, la puerta de entrada es la configuración de cursos.
export default async function TrainingHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/t/${slug}/training/courses`);
}
