/**
 * ─── LANDMARK: DH CAPABILITIES ─────────────────────────────────────────────
 * Отличия dh1/dh2 для общих компонентов. Единственное место, где UI узнаёт,
 * показывать ли `influence`, колонку `+30` и какую усталость считать.
 *
 * 📌 Переключателя редакций в UI больше нет: редакция задаётся модулем при
 * создании (`systemId`), а не полем листа. Fallback на dh1 нужен только для
 * чтения ещё не мигрированных v1-файлов (📌 D3).
 */
export interface DarkHeresyCapabilitySource {
  systemId?: string;
}

export type DarkHeresyEdition = 'dh1' | 'dh2';

export interface DarkHeresyCapabilities {
  readonly edition: DarkHeresyEdition;
  /** Показывать десятую характеристику Influence (только 2e). */
  readonly influence: boolean;
  /** Показывать колонку тренировки +30 (только 2e). */
  readonly plus30: boolean;
  /** Какое поле усталости существует у редакции. */
  readonly fatigueField: 'fatigue1st' | 'fatigue2nd';
}

export function getDarkHeresyCapabilities(
  character: DarkHeresyCapabilitySource,
): DarkHeresyCapabilities {
  const edition: DarkHeresyEdition =
    character.systemId === 'dh2' ? 'dh2' : 'dh1';
  return edition === 'dh2'
    ? {
        edition,
        influence: true,
        plus30: true,
        fatigueField: 'fatigue2nd',
      }
    : {
        edition,
        influence: false,
        plus30: false,
        fatigueField: 'fatigue1st',
      };
}
