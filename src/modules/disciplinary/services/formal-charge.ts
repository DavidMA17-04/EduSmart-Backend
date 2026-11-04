export interface FormalChargeBodyInput {
  caseNumber: string;
  infractionName: string;
  severityLabel: string;
  deduction: number;
  occurredOn: string;
  place: string;
  description: string;
  proposedAction: string;
}

export function buildFormalChargeBody(input: FormalChargeBodyInput): string {
  return [
    `Comunicación formal del expediente ${input.caseNumber}.`,
    `Falta atribuida: ${input.infractionName}.`,
    `Gravedad: ${input.severityLabel}. Rebajo propuesto: ${input.deduction} puntos.`,
    `Fecha del hecho: ${input.occurredOn}.`,
    `Lugar: ${input.place}.`,
    `Hechos: ${input.description}`,
    `Acción correctiva propuesta: ${input.proposedAction}`,
    'Cuenta con 3 días hábiles a partir de esta notificación para presentar su descargo.',
  ].join('\n');
}
