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
}

export interface VisualAccount {
  username: string;
  password: string;
  user: VisualUser;
  dndId: string;
  dhId: string;
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
}

export const STATE_FILE =
  process.env.DCS_VISUAL_STATE ||
  path.resolve(process.cwd(), '.visual-state.json');

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
    const account: VisualAccount = {
      username: legacy.username,
      password: legacy.password,
      user: legacy.user,
      dndId: legacy.dndId,
      dhId: legacy.dhId,
    };
    return { baseURL: legacy.baseURL, canonical: account, workers: [account] };
  }
  return parsed;
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

export function readAllAccounts(): VisualAccount[] {
  const file = readStateFile();
  return [file.canonical, ...file.workers];
}
