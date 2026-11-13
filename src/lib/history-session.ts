import {
  HISTORY_SESSION_GAP_MS,
  type HistoryChange,
  type HistoryMarker,
  type HistoryRevision,
  type HistorySession,
  type StoredValue,
} from './history-types';

/**
 * ─── LANDMARK: HISTORY SESSION ──────────────────────────────────────────────
 * Журнал хранит каждое сохранение, но человеку нужны не PUT-ы, а игровые
 * сессии. Здесь ревизии склеиваются в сессии по паузе (30 минут), а изменения
 * внутри сессии сворачиваются: для одного поля остаются первое «было» и
 * последнее «стало». Так автосохранение на каждом изменении не превращает
 * таймлайн в сотню одинаковых строк.
 *
 * Функции чистые: ни fs, ни сети, ни знания игр.
 */

export interface GroupSessionsOptions {
  /** Пауза, после которой начинается новая сессия. */
  gapMs?: number;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    const bKeys = Object.keys(bRecord);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(bRecord, key) &&
        deepEqual(aRecord[key], bRecord[key]),
    );
  }
  return false;
}

function storedEqual(
  a: StoredValue | undefined,
  b: StoredValue | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.truncated === true || b.truncated === true) {
    return (
      a.truncated === true &&
      b.truncated === true &&
      a.preview === b.preview &&
      a.length === b.length
    );
  }
  return deepEqual(a.value, b.value);
}

function changeKey(change: HistoryChange): string {
  const sep = '\u0000';
  if (change.kind === 'bulk') return `bulk${sep}${change.path}`;
  if (change.kind === 'array-add' || change.kind === 'array-remove') {
    return `${change.kind}${sep}${change.path}`;
  }
  if (change.key !== undefined) {
    return `item${sep}${change.path}${sep}${change.key}${sep}${change.field ?? ''}`;
  }
  return `path${sep}${change.path}`;
}

function withExistence(
  base: HistoryChange,
  existedBefore: boolean,
  existsAfter: boolean,
  before: StoredValue | undefined,
  after: StoredValue | undefined,
): HistoryChange | null {
  const initial = existedBefore && before !== undefined;
  const final = existsAfter && after !== undefined;
  if (!initial && !final) return null;

  const result: HistoryChange = {
    kind: !initial ? 'added' : !final ? 'removed' : 'changed',
    path: base.path,
    ...(base.key !== undefined ? { key: base.key } : {}),
    ...(base.label !== undefined ? { label: base.label } : {}),
    ...(base.field !== undefined ? { field: base.field } : {}),
  };

  if (!initial) {
    result.after = after;
  } else if (!final) {
    result.before = before;
  } else {
    if (storedEqual(before, after)) return null;
    result.before = before;
    result.after = after;
  }
  return result;
}

function mergeScalar(
  existing: HistoryChange,
  next: HistoryChange,
): HistoryChange | null {
  const existedBefore = existing.kind !== 'added';
  const existsAfter = next.kind !== 'removed';
  const before = existing.before ?? next.before;
  const after = next.after ?? existing.after;
  return withExistence(existing, existedBefore, existsAfter, before, after);
}

/**
 * Свернуть изменения одной сессии. Порядок первого появления сохраняется:
 * так таймлайн не «прыгает» между рендерами.
 */
export function collapseSessionChanges(
  changes: readonly HistoryChange[],
): HistoryChange[] {
  const merged = new Map<string, HistoryChange>();
  const order: string[] = [];

  for (const change of changes) {
    const key = changeKey(change);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...change,
        ...(change.values ? { values: [...change.values] } : {}),
      });
      order.push(key);
      continue;
    }

    if (change.kind === 'array-add' && existing.kind === 'array-add') {
      merged.set(key, {
        ...existing,
        values: [...(existing.values ?? []), ...(change.values ?? [])],
      });
      continue;
    }
    if (change.kind === 'array-remove' && existing.kind === 'array-remove') {
      merged.set(key, {
        ...existing,
        values: [...(existing.values ?? []), ...(change.values ?? [])],
      });
      continue;
    }

    if (change.kind === 'bulk' || existing.kind === 'bulk') {
      merged.set(key, change);
      continue;
    }

    const next = mergeScalar(existing, change);
    if (next) {
      merged.set(key, next);
    } else {
      merged.delete(key);
    }
  }

  return order
    .map((key) => merged.get(key))
    .filter((change): change is HistoryChange => change !== undefined);
}

interface MutableSession {
  id: string;
  startedAt: string;
  endedAt: string;
  revisionCount: number;
  changes: HistoryChange[];
  markers: HistoryMarker[];
  lastAt: number;
}

function newSession(revision: HistoryRevision, at: number): MutableSession {
  return {
    id: revision.id,
    startedAt: revision.at,
    endedAt: revision.at,
    revisionCount: 0,
    changes: [],
    markers: [],
    lastAt: at,
  };
}

function appendRevision(
  session: MutableSession,
  revision: HistoryRevision,
): void {
  session.endedAt = revision.at;
  session.revisionCount += 1;
  session.changes.push(...revision.changes);
  if (revision.source !== 'save') {
    session.markers.push({ source: revision.source, at: revision.at });
  }
  const at = Date.parse(revision.at);
  if (Number.isFinite(at)) session.lastAt = at;
}

/**
 * Сгруппировать ревизии в сессии. Возвращает **новые сверху**: API и экран
 * показывают свежие изменения первыми.
 */
export function groupHistorySessions(
  revisions: readonly HistoryRevision[],
  options: GroupSessionsOptions = {},
): HistorySession[] {
  if (revisions.length === 0) return [];

  const gapMs = options.gapMs ?? HISTORY_SESSION_GAP_MS;
  // Файл и так пишется по порядку, но после ручной правки/компакции порядок
  // лучше не предполагать.
  const sorted = [...revisions].sort((a, b) => {
    const left = Date.parse(a.at);
    const right = Date.parse(b.at);
    if (Number.isFinite(left) && Number.isFinite(right) && left !== right) {
      return left - right;
    }
    return 0;
  });

  const sessions: MutableSession[] = [];
  let current: MutableSession | null = null;

  for (const revision of sorted) {
    const at = Date.parse(revision.at);
    let target: MutableSession;

    if (
      current === null ||
      (Number.isFinite(at) &&
        Number.isFinite(current.lastAt) &&
        at - current.lastAt > gapMs)
    ) {
      target = newSession(revision, at);
      current = target;
      sessions.push(target);
    } else {
      target = current;
    }

    appendRevision(target, revision);
  }

  return sessions
    .map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      revisionCount: session.revisionCount,
      changes: collapseSessionChanges(session.changes),
      markers: session.markers,
      truncated: false,
    }))
    .reverse();
}
