"use client";

import { useState, type ReactNode } from "react";
import { StageSection } from "@/components/ui";
import type { AuditStandard } from "@/domain/audits/types";
import {
  EditObjectiveForm,
  type MemberOption,
  type ObjectiveDefaults,
} from "@/app/(tenant)/t/[slug]/indicators/ObjectiveForms";

/** El objetivo se ve confirmado (resumen) y se edita solo si el usuario lo pide. */
export function EditableObjective({
  slug,
  objectiveId,
  members,
  defaults,
  standards,
  canEdit,
  summary,
}: {
  slug: string;
  objectiveId: string;
  members: MemberOption[];
  defaults: ObjectiveDefaults;
  standards: AuditStandard[];
  canEdit: boolean;
  summary: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <StageSection
      title="Objetivo"
      done
      current={false}
      canWrite={canEdit}
      editing={editing}
      onEdit={() => setEditing(true)}
      onCancel={() => setEditing(false)}
      summary={summary}
      form={
        <EditObjectiveForm
          slug={slug}
          objectiveId={objectiveId}
          members={members}
          defaults={defaults}
          standards={standards}
          onSaved={() => setEditing(false)}
        />
      }
    />
  );
}
