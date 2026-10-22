import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { SessionForm } from "@/app/(tenant)/t/[slug]/training/sessions/new/SessionForm";
import { listCourses } from "@/lib/training-config";
import { listJobPositions, listSites } from "@/lib/masterdata";
import { listTenantMembers } from "@/lib/identity";
import { trainingToday } from "@/lib/training";
import { EmptyState, SectionBlock } from "@/components/ui";

export default async function NewSessionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canRecord } = await loadTrainingAccess(slug);
  if (!canRecord) notFound();
  const [courses, sites, positions, members] = await Promise.all([listCourses(tenant.id), listSites(tenant.id), listJobPositions(tenant.id), listTenantMembers(tenant.id)]);
  const base = `/t/${slug}/training`;

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`${base}/sessions`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a Sesiones
        </Link>
      </p>
      <SectionBlock title="Nueva sesión" what="Una capacitación dictada, con sus asistentes y el resultado de cada uno." next="elegí el curso, tildá a quienes asistieron y registrá.">
        {courses.length === 0 ? (
          <EmptyState what="Todavía no hay cursos." next="creá el curso antes de registrar la sesión." action={{ href: `${base}/courses`, label: "Ir a Cursos" }} />
        ) : (
          <SessionForm
            slug={slug}
            today={trainingToday()}
            courses={courses.map((c) => ({ id: c.id, name: c.name, defaultHours: c.defaultHours === null ? null : Number(c.defaultHours), requiresEffectiveness: c.requiresEffectiveness, defaultProvider: c.defaultProvider }))}
            sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            positions={positions.map((p) => ({ id: p.id, name: p.name }))}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
          />
        )}
      </SectionBlock>
    </div>
  );
}
