import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { IndividualForm } from "@/app/(tenant)/t/[slug]/training/sessions/individual/IndividualForm";
import { listCourses } from "@/lib/training-config";
import { listTenantMembers } from "@/lib/identity";
import { trainingToday } from "@/lib/training";
import { prisma } from "@/lib/db";
import { EmptyState, SectionBlock } from "@/components/ui";

export default async function IndividualRecordPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ persona?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canRecord } = await loadTrainingAccess(slug);
  if (!canRecord) notFound();
  const [courses, members, person] = await Promise.all([
    listCourses(tenant.id),
    listTenantMembers(tenant.id),
    sp.persona
      ? prisma.person.findFirst({ where: { id: sp.persona, tenantId: tenant.id, status: "active" }, select: { id: true, name: true, employeeCode: true, site: { select: { name: true } } } })
      : null,
  ]);
  const base = `/t/${slug}/training`;

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={person ? `${base}/people/${person.id}` : `${base}/sessions`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver
        </Link>
      </p>
      <SectionBlock title="Cargar un certificado" what="Una capacitación hecha por una sola persona, por ejemplo un curso externo." next="elegí la persona y el curso; si el certificado trae su propio vencimiento, cargalo.">
        {courses.length === 0 ? (
          <EmptyState what="Todavía no hay cursos." next="creá el curso antes de registrar la capacitación." action={{ href: `${base}/courses`, label: "Ir a Cursos" }} />
        ) : (
          <IndividualForm
            slug={slug}
            today={trainingToday()}
            courses={courses.map((c) => ({ id: c.id, name: c.name, validityMonths: c.validityMonths, requiresEffectiveness: c.requiresEffectiveness }))}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
            defaultPerson={person ? { id: person.id, name: person.name, employeeCode: person.employeeCode, siteName: person.site.name } : null}
          />
        )}
      </SectionBlock>
    </div>
  );
}
