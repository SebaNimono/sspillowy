import { RunbookAction, RunbookInput, RunbookTrigger } from '../api/client';

export const TRIGGER_META: Record<RunbookTrigger, { label: string; description: string; color: string; findings: boolean }> = {
  SECRET_DETECTED: {
    label: 'Secreto detectado',
    description: 'Aparece una credencial que no estaba en análisis anteriores.',
    color: '#cf222e',
    findings: true,
  },
  NEW_FINDING: {
    label: 'Nuevo hallazgo',
    description: 'Aparece un hallazgo nuevo de la severidad elegida o superior.',
    color: '#bc4c00',
    findings: true,
  },
  GATE_BLOCKED: {
    label: 'Gate bloqueado',
    description: 'El Security Gate bloquea un análisis.',
    color: '#8250df',
    findings: false,
  },
  SLA_BREACHED: {
    label: 'Plazo vencido',
    description: 'Un hallazgo supera el plazo de su severidad. Se avisa una sola vez por hallazgo.',
    color: '#bf8700',
    findings: true,
  },
  SCAN_FAILED: {
    label: 'Análisis fallido',
    description: 'Un análisis termina con error y no produce resultados.',
    color: '#6e7781',
    findings: false,
  },
};

export const ACTION_META: Record<RunbookAction['type'], { label: string; description: string; onlyFor?: RunbookTrigger[] }> = {
  email: { label: 'Enviar correo', description: 'Avisa por correo con el resumen del evento.' },
  webhook: { label: 'Publicar en canal', description: 'Envía un mensaje a Slack, Microsoft Teams o a tu propio sistema.' },
  assign_owner: {
    label: 'Asignar responsable',
    description: 'Asigna el secreto a una persona en Secret Management (si aún no tiene).',
    onlyFor: ['SECRET_DETECTED'],
  },
  set_in_review: {
    label: 'Pasar a En revisión',
    description: 'Marca los hallazgos del evento como "En revisión".',
    onlyFor: ['SECRET_DETECTED', 'NEW_FINDING', 'SLA_BREACHED'],
  },
  rescan: { label: 'Relanzar análisis', description: 'Encola un nuevo análisis del repositorio con los mismos motores.' },
};

export const WEBHOOK_KIND_LABEL = { slack: 'Slack', teams: 'Microsoft Teams', generic: 'Webhook propio (JSON)' } as const;

export const EMPTY_ACTION: Record<RunbookAction['type'], RunbookAction> = {
  email: { type: 'email', to: [], security_team: true },
  webhook: { type: 'webhook', url: '', kind: 'slack' },
  assign_owner: { type: 'assign_owner', email: '' },
  set_in_review: { type: 'set_in_review' },
  rescan: { type: 'rescan' },
};

export interface RunbookTemplate {
  id: string;
  title: string;
  why: string;
  input: RunbookInput;
}

const base = { enabled: true, conditions: { repository_ids: [], min_severity: 'CRITICAL' as const } };

export const RUNBOOK_TEMPLATES: RunbookTemplate[] = [
  {
    id: 'secret-response',
    title: 'Respuesta a secretos filtrados',
    why: 'Una credencial expuesta es explotable de inmediato: avisa y asigna responsable sin esperar a nadie.',
    input: {
      ...base,
      name: 'Respuesta a secretos filtrados',
      trigger: 'SECRET_DETECTED',
      template: 'secret-response',
      actions: [EMPTY_ACTION.email, { type: 'assign_owner', email: '' }, EMPTY_ACTION.set_in_review],
    },
  },
  {
    id: 'critical-alert',
    title: 'Aviso de nuevos críticos en el canal del equipo',
    why: 'El equipo se entera en su canal de chat en cuanto entra un crítico nuevo.',
    input: {
      ...base,
      name: 'Nuevos críticos al canal del equipo',
      trigger: 'NEW_FINDING',
      template: 'critical-alert',
      actions: [EMPTY_ACTION.webhook],
    },
  },
  {
    id: 'gate-blocked',
    title: 'Gate bloqueado: avisar a seguridad',
    why: 'Un despliegue frenado necesita una decisión rápida: corregir o pedir una excepción.',
    input: {
      ...base,
      name: 'Gate bloqueado: avisar a seguridad',
      trigger: 'GATE_BLOCKED',
      template: 'gate-blocked',
      actions: [EMPTY_ACTION.email],
    },
  },
  {
    id: 'sla-escalation',
    title: 'Escalar hallazgos fuera de plazo',
    why: 'Lo que vence sin atención se escala y pasa a revisión para que no se olvide.',
    input: {
      ...base,
      name: 'Escalar hallazgos fuera de plazo',
      trigger: 'SLA_BREACHED',
      template: 'sla-escalation',
      conditions: { repository_ids: [], min_severity: 'HIGH' },
      actions: [EMPTY_ACTION.email, EMPTY_ACTION.set_in_review],
    },
  },
  {
    id: 'scan-retry',
    title: 'Reintentar análisis fallidos',
    why: 'Un fallo puntual (red, clonado) no deja al repositorio sin analizar.',
    input: {
      ...base,
      name: 'Reintentar análisis fallidos',
      trigger: 'SCAN_FAILED',
      template: 'scan-retry',
      actions: [EMPTY_ACTION.rescan, EMPTY_ACTION.email],
    },
  },
];
