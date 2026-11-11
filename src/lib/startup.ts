import { ensureServiceAdmin, type ServiceAdminReport } from './admin-bootstrap';
import {
  normalizeAllCharacters,
  type NormalizeCharactersReport,
} from './character-schema';
import { getDataDir } from './data-dir';
import { rebuildLoginIndex } from './user-index';
import {
  normalizeUserProfiles,
  type NormalizeProfilesReport,
} from './user-schema';

/**
 * ─── LANDMARK: STARTUP MAINTENANCE ─────────────────────────────────────────
 * Единая точка «приведения данных в порядок» при старте/перезапуске сервера.
 * Вызывается из `src/instrumentation.ts` (Next.js `register()`), то есть один
 * раз на процесс, до обслуживания запросов.
 *
 * Шаги:
 *   1. проверить шаблон всех `users/<uid>/user.json` и дописать недостающие
 *      поля (роль, блокировка, schemaVersion, даты) — см. user-schema.ts;
 *   2. нормализовать `users/<uid>/characters/*.json` до character schema v1:
 *      старые DH-пророчества sentence → стабильные ID (character-schema.ts);
 *   3. пересобрать производный индекс `index/logins.json`;
 *   4. если активного администратора нет — создать служебный аккаунт и
 *      вывести сгенерированный пароль в консоль + файл.
 *
 * Ошибки не пробрасываются: сервер должен подняться даже с частично битым
 * data-dir. Все проблемы уходят в лог и в отчёт (его используют тесты).
 */

export interface StartupReport {
  dataDir: string;
  profiles: NormalizeProfilesReport | null;
  characters: NormalizeCharactersReport | null;
  admin: ServiceAdminReport | null;
  errors: string[];
}

let cachedDataDir = '';
let cachedReport: StartupReport | null = null;

function logProfileReport(report: NormalizeProfilesReport): void {
  console.info(
    `[dcs] startup: профили проверены — всего ${report.total}, обновлено ${report.updated}`,
  );
  for (const issue of report.issues) {
    console.warn(`[dcs] startup: ${issue}`);
  }
}

function logCharacterReport(report: NormalizeCharactersReport): void {
  console.info(
    `[dcs] startup: листы проверены — всего ${report.total}, обновлено ${report.updated}`,
  );
  for (const issue of report.issues) {
    console.warn(`[dcs] startup: ${issue}`);
  }
}

function logAdminReport(report: ServiceAdminReport): void {
  if (!report.created) {
    if (report.error) {
      console.error(`[dcs] startup: ${report.error}`);
    } else {
      console.info('[dcs] startup: активный администратор уже есть');
    }
    return;
  }

  // Пароль печатаем в консоль: файл мог не записаться (read-only data-dir),
  // а без пароля первый вход в /admin невозможен.
  console.info('');
  console.info(
    '┌──────────────────────────────────────────────────────────────┐',
  );
  console.info(
    '│ Создан служебный администратор Digital Character Sheets      │',
  );
  console.info(
    '├──────────────────────────────────────────────────────────────┤',
  );
  console.info(`│ Логин:    ${report.username}`);
  console.info(`│ Пароль:   ${report.password}`);
  console.info('│ Админка:  /admin');
  if (report.credentialsFile) {
    console.info(`│ Файл:     ${report.credentialsFile}`);
  }
  console.info(
    '│ Смените пароль после первого входа.                          │',
  );
  console.info(
    '└──────────────────────────────────────────────────────────────┘',
  );
  console.info('');
}

/**
 * Выполнить стартовую проверку. Повторный вызов в том же процессе и с тем же
 * `DCS_DATA_DIR` ничего не делает (кэш), `force: true` — для тестов.
 */
export function runStartupMaintenance(
  options: { force?: boolean } = {},
): StartupReport {
  const dataDir = getDataDir();
  if (!options.force && cachedReport && cachedDataDir === dataDir) {
    return cachedReport;
  }

  const report: StartupReport = {
    dataDir,
    profiles: null,
    characters: null,
    admin: null,
    errors: [],
  };

  try {
    report.profiles = normalizeUserProfiles();
    logProfileReport(report.profiles);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.errors.push(`profile normalization failed: ${message}`);
    console.error('[dcs] startup: profile normalization failed:', error);
  }

  try {
    report.characters = normalizeAllCharacters();
    logCharacterReport(report.characters);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.errors.push(`character normalization failed: ${message}`);
    console.error('[dcs] startup: character normalization failed:', error);
  }

  try {
    rebuildLoginIndex();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.errors.push(`login index rebuild failed: ${message}`);
    console.error('[dcs] startup: login index rebuild failed:', error);
  }

  try {
    report.admin = ensureServiceAdmin();
    logAdminReport(report.admin);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.errors.push(`admin bootstrap failed: ${message}`);
    console.error('[dcs] startup: admin bootstrap failed:', error);
  }

  cachedDataDir = dataDir;
  cachedReport = report;
  return report;
}
