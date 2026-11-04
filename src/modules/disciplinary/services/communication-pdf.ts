import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { CommunicationKind, DeliveryMedium } from '../constants/disciplinary.enums';

const LOGO_FILENAME = 'ctp-hojancha-logo.png';

const KIND_TITLES: Record<CommunicationKind, string> = {
  [CommunicationKind.DIRECT_REPRIMAND]: 'Amonestación directa',
  [CommunicationKind.FORMAL_CHARGE]: 'Comunicación formal al encargado legal',
  [CommunicationKind.RESOLUTION]: 'Resolución',
  [CommunicationKind.APPEAL_RESOLUTION]: 'Resolución de recurso',
  [CommunicationKind.PRECAUTIONARY]: 'Medida precautoria',
};

const MEDIUM_LABELS: Record<DeliveryMedium, string> = {
  [DeliveryMedium.NOTEBOOK]: 'Cuaderno de comunicaciones',
  [DeliveryMedium.IN_PERSON]: 'Entrega presencial',
};

export interface CommunicationPdfInput {
  caseNumber: string;
  kind: CommunicationKind;
  body: string;
  issuedOn: string;
  deliveryMedium?: DeliveryMedium | null;
  deliveredOn?: string | null;
  receivedByName?: string | null;
}

export function communicationTitle(kind: CommunicationKind): string {
  return KIND_TITLES[kind];
}

/** Carta tamaño carta con el acto ya guardado. El logo se omite si el archivo no está. */
export function buildCommunicationPdf(input: CommunicationPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 46, bottom: 46, left: 54, right: 54 },
    info: { Title: `${communicationTitle(input.kind)} ${input.caseNumber}`, Author: 'EduSmart' },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const logo = resolveLogoPath();
  let headerBottom = 46;
  if (logo) {
    doc.image(logo, 54, 46, { fit: [48, 48] });
    headerBottom = 100;
  }
  doc
    .fillColor('#1F4E79')
    .fontSize(13)
    .text('Colegio Técnico Profesional de Hojancha', logo ? 112 : 54, 48, { width: logo ? 430 : 504 });
  doc.fillColor('#667085').fontSize(8).text('Ministerio de Educación Pública · Hojancha, Guanacaste', { width: logo ? 430 : 504 });
  doc.moveTo(54, headerBottom).lineTo(558, headerBottom).strokeColor('#1F4E79').stroke();

  doc.fillColor('#1F4E79').fontSize(14).text(communicationTitle(input.kind), 54, headerBottom + 16, {
    align: 'center',
    width: 504,
  });
  doc
    .fillColor('#344054')
    .fontSize(10)
    .text(`Expediente ${input.caseNumber} · Emitido ${input.issuedOn}`, { align: 'center', width: 504 });
  doc.moveDown(0.8);
  doc.fontSize(10).fillColor('#1D2939').text(input.body, { width: 504, align: 'left' });

  if (input.deliveryMedium && input.deliveredOn) {
    doc.moveDown(0.8);
    const medium = MEDIUM_LABELS[input.deliveryMedium];
    const received = input.receivedByName ? ` Recibió: ${input.receivedByName}.` : '';
    doc.fontSize(10).fillColor('#1F4E79').text(`Entrega física: ${medium}, el ${input.deliveredOn}.${received}`, {
      width: 504,
    });
  }

  doc
    .fontSize(8)
    .fillColor('#667085')
    .text('Original: encargado legal · Copia: expediente del estudiante · EduSmart · CTP de Hojancha', 54, 730, {
      width: 504,
      align: 'center',
    });
  doc.end();
  return done;
}

function resolveLogoPath(): string | null {
  const candidates = [
    join(__dirname, '..', '..', 'administrative', 'reports', 'assets', LOGO_FILENAME),
    join(process.cwd(), 'src', 'modules', 'administrative', 'reports', 'assets', LOGO_FILENAME),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}
