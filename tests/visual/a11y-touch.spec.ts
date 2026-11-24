import { expect, test } from '@playwright/test';

import { openApp, prepare } from './helpers';

/**
 * ─── LANDMARK: TOUCH TARGETS ───────────────────────────────────────────────
 * Иконочные действия карточки персонажа на телефоне: цель не меньше 44×44 px
 * и доступное имя. Раньше экспорт и удаление были 32 px, у экспорта имя давал
 * только `title`, а у удаления не было ни `title`, ни `aria-label` — промах
 * по кнопке удаления стоил диалога подтверждения (UI-1).
 */
test.describe('тач-цели карточки персонажа', () => {
  test('иконочные действия ≥44 px и с именем @mobile @fast', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/');

    for (const testId of [
      'archive-character',
      'export-json',
      'export-excel',
      'delete-character',
    ]) {
      const action = page.getByTestId(testId).first();
      await expect(action, testId).toBeVisible();
      await expect(action, testId).toHaveAccessibleName(/.+/);

      const box = await action.boundingBox();
      expect(box, `${testId}: геометрия`).not.toBeNull();
      expect(box!.width, `${testId}: ширина`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${testId}: высота`).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('типографика по шкале', () => {
  test('заголовок дашборда берёт sm:text-3xl, а не 2xl @desktop @fast', async ({
    page,
    context,
  }) => {
    await prepare(context);
    await openApp(page, '/');

    // `text-2xl` + `sm:text-3xl`: до переезда шкалы в `@theme` утилиты были
    // объявлены с `!important` и адаптивный вариант не срабатывал.
    const size = await page
      .getByRole('heading', { level: 1 })
      .first()
      .evaluate((element) => getComputedStyle(element).fontSize);
    expect(size).toBe('30px');
  });
});
