import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { translations } from '@/lib/i18n';

/**
 * ─── LANDMARK: PASSWORD FIELD GUARD ────────────────────────────────────────
 * Глазок должен быть у КАЖДОГО поля пароля, а «Предыстория» — с иконкой
 * книги, чтобы её не путали с показом/скрытием. Тест статический: он не
 * рендерит компоненты, а проверяет, что сырых `type="password"` не осталось и
 * все поля идут через PasswordInput.
 */

const ROOT = process.cwd();

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

/** Все места с полем пароля: вход, регистрация, восстановление, настройки,
 *  админ-редактирование и удаление аккаунта. */
const PASSWORD_FILES = [
  'src/app/login/page.tsx',
  'src/app/settings/page.tsx',
  'src/components/admin/user-edit-dialog.tsx',
  'src/components/settings/delete-account-card.tsx',
];

describe('поле пароля с глазком', () => {
  it('сырых type="password" в разметке не осталось', () => {
    const offenders = walk(path.join(ROOT, 'src')).filter((file) =>
      fs.readFileSync(file, 'utf8').includes('type="password"'),
    );
    expect(offenders).toEqual([]);
  });

  it('все шесть полей идут через PasswordInput', () => {
    for (const file of PASSWORD_FILES) {
      const source = read(file);
      expect(source, file).toContain("from '@/components/ui/password-input'");
      expect(source, file).toContain('<PasswordInput');
    }
    // Три формы на странице входа: вход, регистрация, восстановление.
    expect(
      read('src/app/login/page.tsx').match(/<PasswordInput/g),
    ).toHaveLength(3);
  });

  it('подписи глазка есть в обеих локалях', () => {
    for (const language of ['en', 'ru'] as const) {
      const dictionary = translations[language] as Record<string, string>;
      expect(dictionary['common.showPassword'], language).toBeTruthy();
      expect(dictionary['common.hidePassword'], language).toBeTruthy();
    }
  });

  it('«Предыстория» использует BookOpen, а не Eye', () => {
    for (const file of [
      'src/games/dh1/sections/info-progression-section.tsx',
      'src/games/dh2/sections/info-progression-section.tsx',
    ]) {
      const source = read(file);
      expect(source, file).toContain('BookOpen');
      expect(source, file).not.toContain('<Eye ');
      expect(source, file).not.toMatch(
        /import \{[^}]*\bEye\b[^}]*\} from 'lucide-react'/,
      );
    }
  });
});
