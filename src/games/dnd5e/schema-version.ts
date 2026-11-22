/**
 * Версия формата листа D&D 5e. Поднята до 2, когда появился `systemId`:
 * legacy-поле `edition` убирает миграция `1 → 2`, а нормализация приводит
 * остальные старые поля.
 */
export const DND5E_SCHEMA_VERSION = 2 as const;
