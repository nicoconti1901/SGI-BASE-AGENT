export type WorkflowStatus = "open" | "in_progress" | "closed";

export const WORKFLOW_STATUSES: WorkflowStatus[] = [
  "open",
  "in_progress",
  "closed",
];

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  open: "Abierta",
  in_progress: "En curso",
  closed: "Cerrada",
};

const ALLOWED_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  open: ["in_progress", "closed"],
  in_progress: ["closed", "open"],
  closed: ["open"],
};

export function isWorkflowStatus(value: string): value is WorkflowStatus {
  return WORKFLOW_STATUSES.includes(value as WorkflowStatus);
}

export function labelWorkflowStatus(status: WorkflowStatus): string {
  return WORKFLOW_STATUS_LABELS[status];
}

export function canTransitionWorkflow(
  from: WorkflowStatus,
  to: WorkflowStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertWorkflowTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
): void {
  if (!canTransitionWorkflow(from, to)) {
    throw new Error(
      `Transición de estado no permitida: ${labelWorkflowStatus(from)} → ${labelWorkflowStatus(to)}`,
    );
  }
}

export const NC_ENTITY_TYPE = "nonconformity";
export const ACTION_ENTITY_TYPE = "corrective_action";

export function dueTitleForAction(input: {
  actionTitle: string;
  ncTitle: string;
}): string {
  return `AC: ${input.actionTitle} (NC: ${input.ncTitle})`;
}
