import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  canSeeReserved,
  canViewCase,
  CaseAccessFacts,
  CaseEventAccessFacts,
  DisciplinaryActor,
  visibleEvents,
  visibleWitnesses,
} from './disciplinary-access.policy';

@Injectable()
export class DisciplinaryAccessService {
  assertCanView(actor: DisciplinaryActor, facts: CaseAccessFacts): void {
    if (!canViewCase(actor, facts)) {
      throw new ForbiddenException('No tiene acceso a este expediente');
    }
  }

  canSeeReserved(actor: DisciplinaryActor, facts: CaseAccessFacts): boolean {
    return canSeeReserved(actor, facts);
  }

  witnessesFor(actor: DisciplinaryActor, facts: CaseAccessFacts, witnesses: string | null): string | null {
    return visibleWitnesses(actor, facts, witnesses);
  }

  eventsFor<T extends CaseEventAccessFacts>(
    actor: DisciplinaryActor,
    facts: CaseAccessFacts,
    events: readonly T[],
  ): T[] {
    return visibleEvents(actor, facts, events);
  }
}
