import { loadRoadAccess } from "@/app/(tenant)/t/[slug]/road-safety/access";
import { DriverTaskForm, SettingsForm } from "@/app/(tenant)/t/[slug]/road-safety/ajustes/AjustesForms";
import { getRoadSafetySettings } from "@/lib/road-safety";
import { getDriverTask } from "@/lib/road-drivers";
import { listJobTasks } from "@/lib/masterdata";
import { HintCallout, SectionBlock } from "@/components/ui";

export default async function RoadSafetySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadRoadAccess(slug);
  const [settings, task, tasks] = await Promise.all([getRoadSafetySettings(tenant.id), getDriverTask(tenant.id), listJobTasks(tenant.id)]);

  return (
    <div className="flex flex-col gap-6">
      <SectionBlock
        title="Umbrales del tablero"
        what="Cuándo avisar «poca exposición» y a partir de cuántos hechos un conductor aparece para revisar."
        next={canManage ? undefined : "consultá los valores; solo el administrador y el responsable de proceso los cambian."}
      >
        <SettingsForm slug={slug} canManage={canManage} initial={settings} />
      </SectionBlock>

      <SectionBlock title="Conductores habilitados" what="Un conductor está habilitado con la licencia vigente y el manejo defensivo vigente.">
        <DriverTaskForm slug={slug} canManage={canManage} tasks={tasks.map((t) => ({ id: t.id, name: t.name }))} current={task?.id ?? ""} />
        <HintCallout>
          El manejo defensivo sale de los cursos obligatorios de esa tarea en Capacitaciones. Si la tarea no exige ningún curso, el conductor no queda habilitado.
        </HintCallout>
      </SectionBlock>
    </div>
  );
}
