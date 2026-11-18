import fs from 'node:fs';
import path from 'node:path';

/**
 * Состояние, которое global-setup передаёт воркерам через файл.
 *
 * Данные изолированы **по воркерам**: визуальные тесты правят персонажей
 * (редактирование секций, массовый редактор), поэтому два воркера на одном
 * аккаунте давали бы гонки и «мигающие» скриншоты. Каждому воркеру —
 * свой аккаунт с одинаковым набором персонажей: картинки от этого не
 * меняются (фикстуры те же), а данные не пересекаются.
 *
 * Отдельный `canonical`-аккаунт нужен там, где на скриншоте виден логин:
 * страница `/settings` показывает имя пользователя, поэтому её снимают
 * всегда под фиксированным `visual-tests` — иначе эталоны разъехались бы
 * между воркерами.
 */
export interface VisualUser {
  uid: string;
  username: string;
  displayName: string;
  hasRecoveryPhrase: boolean;
  /** Роль из /api/auth (нужна /admin). */
  role?: 'admin' | 'user';
  isBlocked?: boolean;
  mustChangePassword?: boolean;
}

export interface VisualAccount {
  username: string;
  password: string;
  user: VisualUser;
  /**
   * id посеянных персонажей по сегменту игры (`dnd`, `dh`, …). Сегмент игра
   * объявляет сама в `src/games/<id>/tests/visual.json` (`nameSegment`) — том
   * же, что попадает в имена эталонов. Игры без фикстуры в наборе отсутствуют.
   */
  characters: Record<string, string>;
  /**
   * Legacy-алиасы `characters.dnd` / `characters.dh` (пустая строка, если
   * фикстуры такой игры нет). Оставлены, чтобы хостовые спеки, снимающие
   * листы D&D/DH, читались как раньше.
   */
  dndId: string;
  dhId: string;
  /**
   * Гостевая ссылка на лист `characters.dnd`, если global-setup имел доступ
   * к data-dir. Публичная страница /share/<token> не требует логина.
   */
  share?: { token: string; historyToken?: string; characterId: string };
}

export interface VisualState extends VisualAccount {
  baseURL: string;
}

export interface VisualStateFile {
  baseURL: string;
  /** Аккаунт для скриншотов, где виден логин (страница настроек). */
  canonical: VisualAccount;
  /** По одному изолированному аккаунту на воркер. */
  workers: VisualAccount[];
  /**
   * Служебный администратор временного сервера. Появляется, только когда
   * global-setup знает DCS_DATA_DIR (запуск через scripts/visual.sh). Без
   * него админские снимки честно пропускаются.
   */
  admin?: VisualAccount;
}

export const STATE_FILE =
  process.env.DCS_VISUAL_STATE ||
  path.resolve(process.cwd(), '.visual-state.json');

/**
 * Приводит запись аккаунта к текущему формату: `characters` — источник истины,
 * `dndId`/`dhId` — производные алиасы. Файл состояния мог остаться от прошлой
 * сборки (там были только алиасы), поэтому читаем оба варианта.
 */
function normalizeAccount(account: Partial<VisualAccount>): VisualAccount {
  const characters: Record<string, string> = { ...(account.characters ?? {}) };
  if (!characters.dnd && account.dndId) characters.dnd = account.dndId;
  if (!characters.dh && account.dhId) characters.dh = account.dhId;
  return {
    ...(account as VisualAccount),
    characters,
    dndId: characters.dnd ?? '',
    dhId: characters.dh ?? '',
  };
}

function readStateFile(): VisualStateFile {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      `Нет файла состояния ${STATE_FILE}. Запускайте тесты через "npm run test:visual" ` +
        '(или "npx playwright test", если сервер уже поднят и global-setup может его заполнить).',
    );
  }
  const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as
    VisualStateFile | VisualState;

  // Совместимость со старым форматом (один аккаунт): global-setup мог быть
  // из другой сборки, а файл состояния остался.
  if (!('workers' in parsed)) {
    const legacy = parsed as VisualState;
    const account = normalizeAccount({
      username: legacy.username,
      password: legacy.password,
      user: legacy.user,
      characters: legacy.characters,
      dndId: legacy.dndId,
      dhId: legacy.dhId,
    });
    return { baseURL: legacy.baseURL, canonical: account, workers: [account] };
  }
  return {
    baseURL: parsed.baseURL,
    canonical: normalizeAccount(parsed.canonical),
    workers: parsed.workers.map(normalizeAccount),
    ...(parsed.admin ? { admin: normalizeAccount(parsed.admin) } : {}),
  };
}

/** Состояние аккаунта конкретного воркера (0..N-1). */
export function readState(workerIndex = 0): VisualState {
  const file = readStateFile();
  const workers = file.workers.length ? file.workers : [file.canonical];
  const account = workers[workerIndex % workers.length];
  return { baseURL: file.baseURL, ...account };
}

/** Аккаунт для снимков, где виден логин (страница настроек). */
export function readCanonicalState(): VisualState {
  const file = readStateFile();
  return { baseURL: file.baseURL, ...file.canonical };
}

/**
 * Служебный администратор для снимков /admin. `null` — global-setup не смог
 * его подготовить (например, запуск с --base-url без доступа к data-dir):
 * админские визуальные тесты в этом случае пропускаются.
 */
export function readAdminState(): VisualState | null {
  // При `playwright --list` global-setup не запускается и файла может не быть:
  // админские тесты в этом режиме просто пропускаются, остальные спеки не
  // должны падать на импорте.
  if (!fs.existsSync(STATE_FILE)) return null;
  const file = readStateFile();
  if (!file.admin) return null;
  return { baseURL: file.baseURL, ...file.admin };
}

export function readAllAccounts(): VisualAccount[] {
  const file = readStateFile();
  return [file.canonical, ...file.workers];
}
