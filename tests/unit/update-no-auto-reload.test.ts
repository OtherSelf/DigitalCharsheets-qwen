import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Обновление сборки не должно перезагружать вкладку само: в ней может быть
 * несохранённый ввод. Клиентский сторож только показывает баннер; Next
 * `deploymentId` делает hard navigation на переходах, а `beforeunload`
 * защищает правки. Тест — статический: он ловит случайно добавленный
 * `location.reload()`/`router.refresh()` в трёх компонентах обновления.
 */
const FILES = [
  'src/components/layout/build-watcher.tsx',
  'src/components/layout/update-banner.tsx',
  'src/components/layout/client-error-guard.tsx',
];

describe('обновление сборки без авто-перезагрузки', () => {
  for (const file of FILES) {
    it(`${file}: нет программной перезагрузки`, () => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source).not.toContain('location.reload');
      expect(source).not.toContain('router.refresh');
      expect(source).not.toContain('window.location.reload');
    });
  }
});
