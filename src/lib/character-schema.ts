import fs from 'fs';
import path from 'path';

import { healCharacterDerive } from './character-derive';
import { appendMigrationMarker } from './character-history';
import {
  normalizeCharacterRecord,
  type ParsedCharacterRecord,
} from './character-version';
import { getCharactersDir, getUsersDir } from './data-dir';
import { withDataLock } from './data-lock';
import { writeJsonAtomic } from './fs-atomic';
import { isUid } from './ids';

/**
 * ─── LANDMARK: CHARACTER SCAN ──────────────────────────────────────────────
 * Startup-обход `users/<uid>/characters/*.json`: нормализует файлы до
 * character schema v1 и пишет только реально изменившиеся. Чистая логика
 * версии/пророчеств — в `character-version.ts` (её использует и клиентский
 * импорт).
 */
export interface NormalizeCharactersReport {
  total: number;
  updated: number;
  /** Сколько шагов цепочек миграций применено ко всем листам. */
  migrations: number;
  /** Сколько листов получило пересчитанные производные. */
  derived: number;
  issues: string[];
}

/**
 * Пройти по всем `users/<uid>/characters/*.json`, нормализовать и записать
 * изменённые файлы. Вызывается из startup maintenance. Ошибки не бросаются:
 * один битый/чужой файл не должен мешать подняться серверу.
 */
export function normalizeAllCharacters(): NormalizeCharactersReport {
  const report: NormalizeCharactersReport = {
    total: 0,
    updated: 0,
    migrations: 0,
    derived: 0,
    issues: [],
  };

  let userDirs: fs.Dirent[] = [];
  try {
    userDirs = fs.readdirSync(getUsersDir(), { withFileTypes: true });
  } catch {
    return report;
  }

  for (const userEntry of userDirs) {
    if (!userEntry.isDirectory() || !isUid(userEntry.name)) continue;
    const charsDir = getCharactersDir(userEntry.name);
    let files: string[] = [];
    try {
      files = fs.readdirSync(charsDir).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }

    for (const file of files) {
      const full = path.join(charsDir, file);
      report.total += 1;
      let parsed: unknown;
      try {
        parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
      } catch (error) {
        report.issues.push(
          `users/${userEntry.name}/characters/${file}: не читается (${error instanceof Error ? error.message : 'unknown'})`,
        );
        continue;
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        report.issues.push(
          `users/${userEntry.name}/characters/${file}: JSON не объект`,
        );
        continue;
      }

      const normalized: ParsedCharacterRecord = normalizeCharacterRecord(
        parsed as Record<string, unknown>,
      );
      for (const issue of normalized.issues) {
        report.issues.push(
          `users/${userEntry.name}/characters/${file}: ${issue}`,
        );
      }

      // Производные «догоняют» лист, сохранённый по старой версии схемы:
      // значения меняются, поэтому перезапись идёт по тем же правилам, что у
      // миграции — с .bak и маркером в истории.
      const beforeVersion =
        typeof (parsed as Record<string, unknown>).schemaVersion === 'number'
          ? Number((parsed as Record<string, unknown>).schemaVersion)
          : 0;
      const healed = healCharacterDerive(
        normalized.character as unknown as Record<string, unknown>,
        beforeVersion,
      ) as unknown as ParsedCharacterRecord['character'];
      const derivedChanged =
        JSON.stringify(healed) !==
        JSON.stringify(
          normalized.character as unknown as Record<string, unknown>,
        );

      if (!normalized.changed && !derivedChanged) continue;

      const rewritten = derivedChanged ? healed : normalized.character;
      const rewroteValues = normalized.migrationsApplied > 0 || derivedChanged;

      try {
        // Перед первой перезаписью листа, у которого меняются значения,
        // кладём рядом .bak: миграция и пересчёт необратимы, а данные
        // пользователя — нет.
        if (rewroteValues) {
          report.migrations += normalized.migrationsApplied;
          if (derivedChanged) report.derived += 1;
          const backupPath = `${full}.bak`;
          if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(full, backupPath);
          }
        }
        withDataLock(() => writeJsonAtomic(full, rewritten));
        report.updated += 1;
        // Маркер пишется после лока: appendHistory при компакции берёт тот же
        // data-lock, вложенный лок — взаимоблокировка.
        if (rewroteValues) {
          try {
            appendMigrationMarker(userEntry.name, file.slice(0, -5));
          } catch (historyError) {
            console.warn(
              `Failed to append migration marker for ${file}:`,
              historyError,
            );
          }
        }
      } catch (error) {
        report.issues.push(
          `users/${userEntry.name}/characters/${file}: не удалось записать (${error instanceof Error ? error.message : 'unknown'})`,
        );
      }
    }
  }

  return report;
}
