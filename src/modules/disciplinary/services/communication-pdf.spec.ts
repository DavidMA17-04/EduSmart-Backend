import { CommunicationKind, DeliveryMedium } from '../constants/disciplinary.enums';
import { buildCommunicationPdf } from './communication-pdf';

describe('PDF de una comunicación', () => {
  it('cabe en una página tamaño carta', async () => {
    const buffer = await buildCommunicationPdf({
      caseNumber: 'AM-2026-0008',
      kind: CommunicationKind.FORMAL_CHARGE,
      issuedOn: '2026-10-16',
      body: 'Falta atribuida: Agresión.\nHechos: Empujó a un compañero durante el recreo.\nAcción correctiva propuesta: Amonestación escrita.',
      deliveryMedium: DeliveryMedium.NOTEBOOK,
      deliveredOn: '2026-10-16',
      receivedByName: 'María Solano',
    });
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = buffer.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? [];
    expect(pages).toHaveLength(1);
  });
});
