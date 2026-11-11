import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidEmail,
  assertValidNationalId,
  buildPersonas,
  dryRunPlanSummary,
  EMAIL_DOMAIN,
  NATIONAL_ID_PREFIX,
} from './lib/presentacion-universitaria/constants.mjs';
import { emptyManifest } from './lib/presentacion-universitaria/manifest.mjs';
import { validatePersonasStatic } from './lib/presentacion-universitaria/validate.mjs';

describe('seed-presentacion-universitaria (estático)', () => {
  it('valida cédulas sintéticas 9 dígitos y correos example.invalid', () => {
    const { students } = buildPersonas();
    for (const s of students) {
      const digits = assertValidNationalId(s.nationalId);
      assert.ok(digits.startsWith(NATIONAL_ID_PREFIX));
      assert.ok(assertValidEmail(s.email).endsWith(`@${EMAIL_DOMAIN}`));
    }
  });

  it('no hay duplicados de cédula ni correo en el dataset', () => {
    const result = validatePersonasStatic();
    assert.equal(result.userCount, 35 + 9 + 25 + 3);
  });

  it('el plan dry-run reporta volúmenes esperados', () => {
    const plan = dryRunPlanSummary();
    assert.equal(plan.students, 35);
    assert.equal(plan.guardians, 25);
    assert.equal(plan.teachers, 9);
    assert.ok(plan.disciplinary_cases >= 6);
  });

  it('manifiesto vacío tiene buckets principales', () => {
    const m = emptyManifest();
    assert.ok(Array.isArray(m.users));
    assert.ok(Array.isArray(m.disciplinary_cases));
    assert.equal(m.version, 1);
  });
});
