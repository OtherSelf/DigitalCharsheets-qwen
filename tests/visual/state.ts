import fs from 'node:fs';
import path from 'node:path';

/**
 * Состояние, которое global-setup передаёт воркерам через файл:
 * учётные данные визуального аккаунта и id созданных персонажей.
 */
export interface VisualUser {
  uid: string;
  username: string;
  displayName: string;
  hasRecoveryPhrase: boolean;
}

export interface VisualState {
  baseURL: string;
  username: string;
  password: string;
  user: VisualUser;
  dndId: string;
  dhId: string;
}

export const STATE_FILE =
  process.env.DCS_VISUAL_STATE ||
  path.resolve(process.cwd(), '.visual-state.json');

export function readState(): VisualState {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      `Нет файла состояния ${STATE_FILE}. Запускайте тесты через "npm run test:visual" ` +
        '(или "npx playwright test", если сервер уже поднят и global-setup может его заполнить).',
    );
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as VisualState;
}
