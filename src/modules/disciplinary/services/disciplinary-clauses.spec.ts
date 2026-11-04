import { SmtpNotConfiguredError } from '../../../integrations/mail/mail.service';
import { NotificationEmailStatus } from '../constants/disciplinary.enums';
import { MANDATORY_CLAUSES, emailStatusFor, withMandatoryClauses } from './disciplinary-clauses';

describe('cláusulas y correo de la comunicación', () => {
  it('agrega las cláusulas aunque el texto no las traiga', () => {
    const body = withMandatoryClauses('Se amonesta al estudiante por llegar tarde.');
    expect(body).toContain('Se amonesta al estudiante por llegar tarde.');
    for (const clause of MANDATORY_CLAUSES) {
      expect(body).toContain(clause);
    }
  });

  it('sin SMTP el correo queda SKIPPED y otro fallo queda FAILED', () => {
    expect(emailStatusFor(new SmtpNotConfiguredError())).toBe(NotificationEmailStatus.SKIPPED);
    expect(emailStatusFor(new Error('smtp down'))).toBe(NotificationEmailStatus.FAILED);
  });
});
