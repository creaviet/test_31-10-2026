/**
 * Phasenschalter (T-09, T-02-Entscheidung: Konfigurationsdatei).
 *
 * - Wird bei JEDEM Login-Anlauf neu gelesen (BE-01, "Wechsel ohne Neustart").
 * - Gesetzt wird NUR von R-OPS über PUT /api/admin/phase (API-06).
 * - Kein hartkodiertes Datum im Code (FR-42).
 * - Jede Änderung wird zusätzlich in event_log protokolliert (durch den Route-Handler).
 */
import fs from 'node:fs';
import path from 'node:path';
import { cfg } from './config.js';

const VALID = new Set(['phase1', 'phase2']);

export function readPhase() {
  let raw;
  try {
    raw = fs.readFileSync(cfg.phaseConfigFile, 'utf8');
  } catch {
    return { error: 'UNAVAILABLE' };
  }
  try {
    const data = JSON.parse(raw);
    if (!VALID.has(data.phase)) return { error: 'INVALID' };
    return {
      phase: data.phase,
      changed_at: data.changed_at ?? null,
      changed_by: data.changed_by ?? null,
      reason: data.reason ?? null,
    };
  } catch {
    return { error: 'INVALID' };
  }
}

export function writePhase({ phase, reason, changedBy }) {
  const payload = {
    phase,
    changed_at: new Date().toISOString(),
    changed_by: changedBy,
    reason,
  };
  const dir = path.dirname(cfg.phaseConfigFile);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.phase-config.tmp-${process.pid}`);
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, cfg.phaseConfigFile); // atomisch — kein halb geschriebener Zustand
  return payload;
}