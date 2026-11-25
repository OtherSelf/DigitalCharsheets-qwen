import {
  enforceDh1Fields,
  ensureConditions,
  ensureExperienceLog,
  migrateGender,
} from './normalize';

/**
 * ─── LANDMARK: DH1 MIGRATIONS ──────────────────────────────────────────────
 * Цепочка версий схемы листа DH1: `1 → 7`. Каждый шаг вызывает ту же фазовую
 * функцию, что и `normalize`, но привязан к своей версии, поэтому лист можно
 * провести по цепочке и увидеть, что именно изменилось на каждом шаге.
 *
 *   1 → 2  дискриминант редакции (`systemId`, legacy `edition` убран);
 *   2 → 3  поля 2-й редакции разведены: `influence`/`fatigue2nd` → notes;
 *   3 → 4  состояния (`mutations`, `insanityDetails`, `corruptionDetails`)
 *          становятся структурированными записями `conditions`;
 *   4 → 5  пол — каноническим кодом (`identity.gender`);
 *   5 → 6  legacy-поля убраны в заметки «Наследие»;
 *   6 → 7  замороженный текст пророчества (бэкфилл 0.22.0) — без правок данных.
 *
 * Все фазы идемпотентны и не теряют значений: вытесненные поля уходят в
 * `notes` с маркером миграции.
 */

type RawRecord = Record<string, unknown>;

/** v1 → v2: дискриминант редакции. */
export function migrateDh1V1toV2(
  character: Readonly<RawRecord>,
  _warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  delete next.edition;
  return next;
}

/** v2 → v3: поля 2-й редакции убраны, значения сохранены в notes. */
export function migrateDh1V2toV3(
  character: Readonly<RawRecord>,
  warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  enforceDh1Fields(next, warnings);
  ensureExperienceLog(next);
  return next;
}

/** v3 → v4: состояния стали структурными записями. */
export function migrateDh1V3toV4(
  character: Readonly<RawRecord>,
  _warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  ensureConditions(next);
  return next;
}

/** v4 → v5: пол хранится кодом, старый текст — в notes. */
export function migrateDh1V4toV5(
  character: Readonly<RawRecord>,
  warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  migrateGender(next, warnings);
  return next;
}

/** Идентификатор и заголовок вкладки, куда уходят legacy-поля 1e. */
const LEGACY_TAB_ID = 'dh1-legacy';
const LEGACY_TAB_TITLE = 'Наследие';
const MAX_NOTE_TABS = 10;

function isRawRecord(value: unknown): value is RawRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Имена из списка `DH1ListEntry[]` через запятую; мусор отбрасывается. */
function joinEntryNames(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((entry) =>
      isRawRecord(entry) && typeof entry.name === 'string'
        ? entry.name.trim()
        : '',
    )
    .filter(Boolean)
    .join(', ');
}

function rawText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * v5 → v6: шесть legacy-полей 1e уходят во вкладку заметок «Наследие».
 *
 * На бумажном листе это `TRAITS`, `Elite Advances` и степени/модификаторы
 * Безумия и Порчи. В листе они были свободным текстом, дублировали бумагу и
 * не участвовали в механике, поэтому значения не выбрасываются, а
 * переносятся в заметки построчно; сами поля удаляются, чтобы UI их больше
 * не показывал. Повторный прогон ничего не делает: полей уже нет, а вкладка
 * находится по стабильному id — второй такой же вкладки не появится.
 */
export function migrateDh1V5toV6(
  character: Readonly<RawRecord>,
  warnings: string[],
): RawRecord {
  const next: RawRecord = { ...character };
  const insanity = isRawRecord(next.insanityDetails)
    ? next.insanityDetails
    : {};
  const corruption = isRawRecord(next.corruptionDetails)
    ? next.corruptionDetails
    : {};

  const lines: string[] = [];
  const traits = joinEntryNames(next.traits);
  if (traits) lines.push(`Черты: ${traits}`);
  const elite = joinEntryNames(next.eliteAdvances);
  if (elite) lines.push(`Элитные наборы: ${elite}`);
  const insanityDegree = rawText(insanity.degree);
  if (insanityDegree) lines.push(`Степень безумия: ${insanityDegree}`);
  const traumaModifier = rawText(insanity.traumaModifier);
  if (traumaModifier) lines.push(`Модификатор травмы: ${traumaModifier}`);
  const corruptionDegree = rawText(corruption.degree);
  if (corruptionDegree) lines.push(`Степень порчи: ${corruptionDegree}`);
  const corruptionTest = rawText(corruption.test);
  if (corruptionTest) lines.push(`Тест на осквернение: ${corruptionTest}`);

  // Вытесненные ключи убираем всегда, даже пустыми: иначе они остаются в
  // файле и в истории как «мусор после миграции».
  delete next.traits;
  delete next.eliteAdvances;

  const nextInsanity = { ...insanity };
  delete nextInsanity.degree;
  delete nextInsanity.traumaModifier;
  if (Object.keys(nextInsanity).length > 0) {
    next.insanityDetails = nextInsanity;
  } else {
    delete next.insanityDetails;
  }

  const nextCorruption = { ...corruption };
  delete nextCorruption.degree;
  delete nextCorruption.test;
  if (Object.keys(nextCorruption).length > 0) {
    next.corruptionDetails = nextCorruption;
  } else {
    delete next.corruptionDetails;
  }

  if (lines.length === 0) return next;

  const tabs = Array.isArray(next.noteTabs)
    ? next.noteTabs.filter(isRawRecord)
    : [];
  const existing = tabs.find((tab) => tab.id === LEGACY_TAB_ID);

  if (existing) {
    const body = typeof existing.body === 'string' ? existing.body : '';
    const known = new Set(body.split('\n').map((line) => line.trim()));
    const missing = lines.filter((line) => !known.has(line));
    next.noteTabs = tabs.map((tab) =>
      tab === existing
        ? {
            ...tab,
            body: [...(body.trim() ? [body.trim()] : []), ...missing].join(
              '\n',
            ),
          }
        : tab,
    );
  } else if (tabs.length < MAX_NOTE_TABS) {
    next.noteTabs = [
      ...tabs,
      { id: LEGACY_TAB_ID, title: LEGACY_TAB_TITLE, body: lines.join('\n') },
    ];
  } else {
    // Лимит вкладок исчерпан: значения всё равно не теряем и пишем в
    // основные заметки с заголовком блока.
    const notes = rawText(next.notes);
    next.notes = [
      ...(notes ? [notes] : []),
      `${LEGACY_TAB_TITLE}:`,
      ...lines,
    ].join('\n');
    warnings.push(
      'dh1: вкладок заметок лимит — legacy-поля перенесены в основные заметки',
    );
  }

  warnings.push(
    `dh1: legacy-поля состояний перенесены во вкладку «${LEGACY_TAB_TITLE}»`,
  );
  return next;
}

/**
 * v6 → v7: появляются необязательные `divinationText`/`divinationEffectText`
 * (бэкфилл 0.22.0). Шаг ничего не переписывает: у старых листов полей просто
 * нет, `normalize` оставит их отсутствующими, а UI покажет образец.
 */
export function migrateDh1V6toV7(
  character: Readonly<RawRecord>,
  _warnings: string[],
): RawRecord {
  return { ...character };
}
