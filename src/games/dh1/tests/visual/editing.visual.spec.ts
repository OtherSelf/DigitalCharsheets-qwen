import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  expectInputValue,
  gameCharacterId,
  openApp,
  openMobileSection,
  prepare,
  screenshotElement,
  screenshotPage,
  sheetPath,
  signInViaUI,
  startEditing,
} from '../../../../../tests/visual/helpers';
import { PRIVACY_VERSION } from '../../../../lib/legal/privacy';
import { TERMS_VERSION } from '../../../../lib/legal/terms';

/**
 * Режим редактирования Dark Heresy 1-й редакции: поля открываются
 * ЗАПОЛНЕННЫМИ данными, creation-поля после создания только читаются,
 * состояния Безумия/Порчи добавляются и удаляются, свободный опыт считается.
 */

test.describe('редактирование Dark Heresy', { tag: '@plugin:dh1' }, () => {
  test(
    'desktop: инфо, прогрессия, характеристики (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1600 });
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const info = page.locator('#info-section:visible').first();
      await startEditing(info);
      await expectInputValue(info, 'Lucius Varn');
      await screenshotElement(info, 'sheet-dh-edit-info-en.png');

      const progression = page.locator('#progression-section:visible').first();
      await startEditing(progression);
      await screenshotElement(progression, 'sheet-dh-edit-progression-en.png');

      // Фикстура — dh1: девять характеристик, Influence отсутствует.
      // Переключателя редакций больше нет: редакция задаётся модулем.
      const characteristics = page
        .locator('#characteristics-card:visible')
        .first();
      await startEditing(characteristics);
      const statInputs = characteristics.locator('input[type="number"]');
      await expect(statInputs).toHaveCount(9);
      await expect(statInputs.nth(0)).toHaveValue('34');
      await expect(statInputs.nth(5)).toHaveValue('46');
      await screenshotElement(
        characteristics,
        'sheet-dh-edit-characteristics-1st-en.png',
      );
    },
  );

  test(
    'desktop: навыки, снаряжение, инвентарь (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1600 });
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      // Навыки: имена и тренировки открываются в виде полей ввода.
      const skills = page.locator('#skills-talents-panel:visible').first();
      await startEditing(skills);
      // Правка переносит характеристику из суффикса названия в отдельное поле.
      await expectInputValue(skills, 'Awareness');
      await expectInputValue(skills, 'Scholastic Lore');
      await expect(
        skills.getByLabel('Characteristic', { exact: true }).first(),
      ).toHaveValue('perception');
      await screenshotElement(skills, 'sheet-dh-edit-skills-en.png');

      // Снаряжение: броня и оружие с заполненными полями.
      const equipment = page.locator('#equipment-section:visible').first();
      await equipment
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click(); // броня
      await expect(
        equipment.locator('input[type="number"]').first(),
      ).toHaveValue('4');
      await screenshotElement(equipment, 'sheet-dh-edit-equipment-en.png');
      await equipment
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click(); // ближний бой (броня уже Save)
      await expectInputValue(equipment, 'Mono-sword');
      await screenshotElement(
        equipment,
        'sheet-dh-edit-equipment-weapons-en.png',
      );

      // Инвентарь: богатство и предметы.
      const inventory = page.locator('#inventory-section:visible').first();
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click(); // богатство
      await expect(
        inventory.locator('input[type="number"]').first(),
      ).toHaveValue('240');
      await screenshotElement(inventory, 'sheet-dh-edit-inventory-en.png');
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click(); // предметы
      await expectInputValue(inventory, 'Data-slate');
      await screenshotElement(
        inventory,
        'sheet-dh-edit-inventory-items-en.png',
      );
    },
  );

  test(
    'mobile: характеристики, навыки (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(gameCharacterId('dh')));

      const characteristics = page.getByTestId('characteristics-compact');
      await startEditing(characteristics);
      const statInput = characteristics.locator('input[type="number"]').nth(0);
      await expect(statInput).toHaveValue('34');

      // iOS увеличивает страницу на фокусе в поле меньше 16 px: значение
      // проверяем именно на фокусе, а не в покое — правило срабатывает там.
      await statInput.focus();
      const focusedFontSize = await statInput.evaluate(
        (element) => getComputedStyle(element).fontSize,
      );
      expect(Number.parseFloat(focusedFontSize)).toBeGreaterThanOrEqual(16);
      // Возвращаем покой: снимок фиксирует обычное состояние поля.
      await statInput.blur();

      await screenshotPage(page, 'sheet-dh-mobile-edit-characteristics-en.png');

      await openMobileSection(page, 'Skills', 'skills-section');
      const skills = page.locator('#skills-talents-content:visible').first();
      await startEditing(skills);
      await expectInputValue(skills, 'Awareness');
      await screenshotPage(page, 'sheet-dh-mobile-edit-skills-en.png');
    },
  );
});

/**
 * ─── LANDMARK: CREATION EDIT POLICY ────────────────────────────────────────
 * Двухуровневая политика: описательные поля редактируются всегда,
 * creation-поля — только пока пустые. Заполненный мир/роль/пророчество
 * read-only с замком «выбрано при создании». Производные не пересчитываются,
 * поэтому тест проверяет только сам факт записи поля.
 */
test.describe(
  'политика редактирования после создания',
  { tag: '@plugin:dh1' },
  () => {
    const LOCK_HINT =
      'Chosen at creation — recreate the character to change it.';
    const GENDER_LOCK_HINT =
      'Chosen — the gender is fixed after creation; recreate the character to change it.';

    test(
      'DH1: заданные creation-поля только читаются (en)',
      { tag: ['@desktop', '@plugin:dh1'] },
      async ({ page, context }) => {
        await prepare(context);
        await openApp(page, sheetPath(gameCharacterId('dh')));

        const info = page.locator('#info-section:visible').first();
        await startEditing(info);

        // Фикстура задаёт homeWorld, worldVariant, careerPath и пол: эти
        // четыре поля после создания только читаются. Пророчество — текст,
        // его владелец правит в листе.
        await expect(info.getByTestId('creation-lock')).toHaveCount(4);
        // Подсказки локализованы и доступны скринридеру: у пола своя формулировка
        // (он запирается не только «при создании»), у остальных — общая.
        const hints = await info
          .getByTestId('creation-lock')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute('aria-label')),
          );
        expect(hints).toContain(LOCK_HINT);
        expect(hints).toContain(GENDER_LOCK_HINT);
        expect(
          hints.every(
            (hint) => hint === LOCK_HINT || hint === GENDER_LOCK_HINT,
          ),
        ).toBe(true);
        await expect(info.getByText('Imperial World')).toBeVisible();
        await expect(info.getByText('Shrine World')).toBeVisible();
        // Выбора нет даже в режиме правки: смена мира — только пересозданием.
        await expect(info.getByRole('combobox')).toHaveCount(0);
      },
    );
  },
);

/**
 * ─── LANDMARK: CONDITIONS CRUD ─────────────────────────────────────────────
 * Список состояний: добавление только в режиме правки, запись через
 * `updateCharacter`, просмотр — в режиме чтения. Исходные текстовые поля
 * (mutations/disorders/defilements) в UI больше не дублируются.
 */
test.describe('состояния Безумия/Порчи', { tag: '@plugin:dh1' }, () => {
  test(
    'DH1: добавить, сохранить и удалить состояние (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      const id = gameCharacterId('dh');
      await openApp(page, sheetPath(id));

      const info = page.locator('#info-section:visible').first();
      // У списка состояний своя кнопка правки, отдельно от всей «Информации».
      await info.getByTestId('conditions-edit').click();

      const before = await info.getByTestId('condition-entry').count();
      await info.getByRole('button', { name: 'Add condition' }).click();
      await expect(info.getByTestId('condition-entry')).toHaveCount(before + 1);

      const entry = info.getByTestId('condition-entry').last();
      // Поля подписаны aria-label — их же проверяем как доступные имена.
      await entry.getByLabel('Name').fill('Проверка состояния');
      await entry.getByLabel('Severity').fill('2');
      await entry.getByLabel('Notes').fill('Заметка');

      // Ждём PUT, в котором уже есть и название, и заметка: очередь
      // склеивает патчи, поэтому ориентируемся на тело запроса.
      await page.waitForResponse((response) => {
        if (!response.url().includes(`/api/characters/${id}`)) return false;
        if (response.request().method() !== 'PUT') return false;
        const body = response.request().postData() ?? '';
        return body.includes('Проверка состояния') && body.includes('Заметка');
      });

      await info.getByTestId('conditions-save').click();
      await openApp(page, sheetPath(id));

      const reloaded = page.locator('#info-section:visible').first();
      await expect(reloaded.getByText('Проверка состояния')).toBeVisible();
      await expect(reloaded.getByText('Disorder')).toBeVisible();

      await reloaded.getByTestId('conditions-edit').click();
      const stored = reloaded.getByTestId('condition-entry').last();
      await stored.getByRole('button', { name: 'Remove condition' }).click();
      await page.waitForResponse((response) => {
        if (!response.url().includes(`/api/characters/${id}`)) return false;
        if (response.request().method() !== 'PUT') return false;
        return !(response.request().postData() ?? '').includes(
          'Проверка состояния',
        );
      });

      await reloaded.getByTestId('conditions-save').click();
      await openApp(page, sheetPath(id));
      await expect(
        page
          .locator('#info-section:visible')
          .first()
          .getByText('Проверка состояния'),
      ).toHaveCount(0);
    },
  );
});

/**
 * ─── LANDMARK: EXPERIENCE BLOCK ────────────────────────────────────────────
 * «Свободный опыт» — вычисляемое число: при перерасходе оно отрицательное и
 * должно быть красным. В dh1 «Текущий» и «Потрачено» вне Edit — текст,
 * править их можно только из input в режиме правки.
 *
 * Эталоны здесь не снимаем: состояние проверяется ассертами на
 * временном аккаунте, чтобы не раздувать матрицу PNG.
 */
test.describe('блок опыта', { tag: '@plugin:dh1' }, () => {
  async function createAccountSheet(
    page: Page,
    systemId: 'dh1' | 'dh2',
    values: { experience: number; totalExpSpent: number },
  ): Promise<string> {
    const username = `xp-${systemId}-${Date.now()}`;
    const password = 'xp-password-1';
    const registered = await page.request.post('/api/auth/register', {
      data: {
        username,
        password,
        displayName: `XP ${systemId}`,
        recoveryPhrase: 'amber cobalt lantern silver ember frost',
        consent: true,
        privacyVersion: PRIVACY_VERSION,
        termsVersion: TERMS_VERSION,
      },
    });
    expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

    const created = await page.request.post('/api/characters', {
      data: { systemId, name: `XP ${systemId}`, ...values },
    });
    expect([200, 201], 'создание листа').toContain(created.status());
    const { id } = (await created.json()) as { id: string };

    await signInViaUI(page, { username, password });
    return id;
  }

  test(
    'DH1: отрицательный свободный опыт красный, поля опыта только в Edit (en)',
    { tag: '@desktop' },
    async ({ page }) => {
      const id = await createAccountSheet(page, 'dh1', {
        experience: 100,
        totalExpSpent: 250,
      });
      await openApp(page, sheetPath(id));

      const progression = page.locator('#progression-section:visible').first();
      const available = progression.getByTestId('available-exp');
      await expect(available).toHaveText('-150');
      await expect(available).toHaveClass(/text-destructive/);

      // Вне Edit оба поля — текст, полей ввода опыта нет.
      await expect(progression.getByTestId('current-exp-value')).toHaveText(
        '100',
      );
      await expect(progression.getByTestId('total-exp-spent-value')).toHaveText(
        '250',
      );
      await expect(progression.locator('#current-exp-edit')).toHaveCount(0);
      await expect(progression.locator('#total-exp-edit')).toHaveCount(0);

      await startEditing(progression);
      const current = progression.locator('#current-exp-edit');
      const spent = progression.locator('#total-exp-edit');
      await expect(current).toHaveValue('100');
      await expect(spent).toHaveValue('250');

      // Перерасход закрыт: 100 − 40 = 60, цвет снова обычный.
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/characters/${id}`) &&
          response.request().method() === 'PUT',
      );
      await spent.fill('40');
      await spent.blur();
      await saved;
      await expect(available).toHaveText('60');
      await expect(available).toHaveClass(/text-primary/);

      await progression.getByTestId('save-button').first().click();
      await page.reload();
      const reloaded = page.locator('#progression-section:visible').first();
      await expect(reloaded.getByTestId('available-exp')).toHaveText('60');
      await expect(reloaded.getByTestId('current-exp-value')).toHaveText('100');
      await expect(reloaded.getByTestId('total-exp-spent-value')).toHaveText(
        '40',
      );
      await expect(reloaded.locator('#current-exp-edit')).toHaveCount(0);
    },
  );
});

/**
 * ─── LANDMARK: WEAPON CARD REGRESSIONS ─────────────────────────────────────
 * Два бага карточек оружия, воспроизведённые до правки: переключение
 * «Экипировано» в просмотре откатывалось при сохранении правки другого
 * оружия (снимок editableEquipment устаревал), а «Бронепробитие» пропадало
 * из карточки неэкипированного стрелкового оружия. Сценарии ниже — без
 * эталонов: проверяют поведение и сохранённые данные.
 */
test.describe(
  'карточки оружия: экипировка и бронепробитие',
  { tag: '@plugin:dh1' },
  () => {
    const password = 'weapon-password-1';

    async function createSheet(
      page: Page,
      equipment: Record<string, unknown>,
    ): Promise<string> {
      const username = `weapon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'Weapon QA',
          recoveryPhrase: 'amber cobalt lantern silver ember frost',
          consent: true,
          privacyVersion: PRIVACY_VERSION,
          termsVersion: TERMS_VERSION,
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

      const created = await page.request.post('/api/characters', {
        data: { systemId: 'dh1', name: 'Weapon QA' },
      });
      expect([200, 201], 'создание dh1-листа').toContain(created.status());
      const { id } = (await created.json()) as { id: string };

      const updated = await page.request.put(`/api/characters/${id}`, {
        data: { equipment },
      });
      expect(updated.status(), 'запись оружия').toBe(200);

      await signInViaUI(page, { username, password });
      await openApp(page, sheetPath(id));
      return id;
    }

    function displayCard(page: Page, name: string): Locator {
      return page
        .getByText(name, { exact: true })
        .first()
        .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    }

    function editCard(page: Page, name: string): Locator {
      return page
        .locator(`#equipment-section input[value="${name}"]`)
        .first()
        .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    }

    async function savedWeapons(page: Page, id: string) {
      const response = await page.request.get('/api/characters');
      const list = (await response.json()) as Array<{
        id: string;
        equipment: {
          weapons: {
            melee: Array<{
              name: string;
              equipped?: boolean;
              penetration?: string;
            }>;
            ranged: Array<{
              name: string;
              equipped?: boolean;
              penetration?: string;
            }>;
          };
        };
      }>;
      return list.find((character) => character.id === id)?.equipment.weapons;
    }

    test(
      'переключение «Экипировано» не откатывает соседнее оружие',
      { tag: '@desktop' },
      async ({ page }) => {
        const id = await createSheet(page, {
          armor: {
            Head: null,
            'Right arm': null,
            Body: null,
            'Left arm': null,
            'Right leg': null,
            'Left leg': null,
          },
          weapons: {
            melee: [
              {
                id: 'melee-a',
                name: 'Blade A',
                type: 'Blade',
                range: 'Melee',
                penetration: '2',
                damage: '1d10+3',
                traits: '',
                equipped: true,
              },
              {
                id: 'melee-b',
                name: 'Blade B',
                type: 'Blade',
                range: 'Melee',
                penetration: '4',
                damage: '1d10+2',
                traits: '',
                equipped: false,
              },
            ],
            ranged: [],
          },
        });

        const equipment = page.locator('#equipment-section:visible').first();
        await expect(
          displayCard(page, 'Blade A').getByRole('checkbox'),
        ).toBeChecked();

        // Включаем B в режиме просмотра.
        await equipment
          .getByText(/Not equipped \(1\)/)
          .first()
          .click();
        (await displayCard(page, 'Blade B')).getByRole('checkbox').click();
        await expect(
          displayCard(page, 'Blade B').getByRole('checkbox'),
        ).toBeChecked();
        await expect(
          displayCard(page, 'Blade A').getByRole('checkbox'),
        ).toBeChecked();

        // Вход в правку не должен показать устаревший снимок.
        await equipment.getByTestId('edit-button').nth(1).click();
        await expect(
          editCard(page, 'Blade B').getByRole('checkbox'),
        ).toBeChecked();

        // Выключаем A и сохраняем: правка B обязана уцелеть.
        (await editCard(page, 'Blade A')).getByRole('checkbox').click();
        await expect(
          editCard(page, 'Blade B').getByRole('checkbox'),
        ).toBeChecked();
        await page.getByTestId('save-button').first().click();
        await expect
          .poll(async () => (await savedWeapons(page, id))?.melee, {
            message: 'флаги экипировки после сохранения',
          })
          .toEqual([
            expect.objectContaining({ name: 'Blade A', equipped: false }),
            expect.objectContaining({ name: 'Blade B', equipped: true }),
          ]);
      },
    );

    test(
      '«Бронепробитие» остаётся у неэкипированного стрелкового оружия',
      { tag: '@desktop' },
      async ({ page }) => {
        const id = await createSheet(page, {
          armor: {
            Head: null,
            'Right arm': null,
            Body: null,
            'Left arm': null,
            'Right leg': null,
            'Left leg': null,
          },
          weapons: {
            melee: [],
            ranged: [
              {
                id: 'ranged-a',
                name: 'Gun A',
                type: 'Las',
                range: '30 m',
                rof: 'S/2/-',
                damage: '1d10+2',
                clip: 14,
                clipSize: 30,
                reload: 'Full',
                traits: '',
                equipped: true,
                penetration: '1',
              },
              {
                id: 'ranged-b',
                name: 'Gun B',
                type: 'Solid',
                range: '20 m',
                rof: 'S/-/-',
                damage: '1d10+4',
                clip: 8,
                clipSize: 8,
                reload: 'Full',
                traits: '',
                equipped: false,
                penetration: '3',
              },
            ],
          },
        });

        const equipment = page.locator('#equipment-section:visible').first();
        await expect(displayCard(page, 'Gun A')).toContainText(
          'Penetration: 1',
        );

        // Снимаем экипировку: карточка в «Не экипировано» должна сохранить Pen.
        (await displayCard(page, 'Gun A')).getByRole('checkbox').click();
        await equipment
          .getByText(/Not equipped \(2\)/)
          .first()
          .click();
        await expect(displayCard(page, 'Gun A')).toContainText(
          'Penetration: 1',
        );

        // В правке поле тоже на месте и не теряется при сохранении.
        await equipment.getByTestId('edit-button').nth(2).click();
        await expect(
          editCard(page, 'Gun A')
            .locator('div.space-y-1')
            .filter({ hasText: 'Penetration' })
            .locator('input'),
        ).toHaveValue('1');
        await page.getByTestId('save-button').first().click();
        await expect
          .poll(async () => (await savedWeapons(page, id))?.ranged, {
            message: 'бронепробитие после сохранения',
          })
          .toEqual([
            expect.objectContaining({ name: 'Gun A', penetration: '1' }),
            expect.objectContaining({ name: 'Gun B', penetration: '3' }),
          ]);
      },
    );
  },
);

/**
 * ─── LANDMARK: SIMPLE POINTS STEPPER ──────────────────────────────────────
 * Безумие и Порча меняются плюсом/минусом на 1, без кнопки редактирования и
 * модалки; значение сразу уходит в лист и не уходит ниже нуля.
 */
test.describe('Безумие и Порча: плюс и минус', { tag: '@plugin:dh1' }, () => {
  test(
    'DH1: значение меняется на 1 и сохраняется',
    { tag: '@desktop' },
    async ({ page }) => {
      const username = `points-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const password = 'points-password-1';
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'Points QA',
          recoveryPhrase: 'amber cobalt lantern silver ember frost',
          consent: true,
          privacyVersion: PRIVACY_VERSION,
          termsVersion: TERMS_VERSION,
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());
      const created = await page.request.post('/api/characters', {
        data: { systemId: 'dh1', name: 'Points QA' },
      });
      expect([200, 201], 'создание dh1-листа').toContain(created.status());
      const { id } = (await created.json()) as { id: string };

      await signInViaUI(page, { username, password });
      await openApp(page, sheetPath(id));

      const increase = page.locator(
        '[data-testid="insanity-points-increase"]:visible',
      );
      const decrease = page.locator(
        '[data-testid="insanity-points-decrease"]:visible',
      );
      const value = () =>
        increase.locator('xpath=..').locator('span').innerText();
      const box = increase.locator(
        'xpath=ancestor::div[contains(@class,"flex h-full flex-col")][1]',
      );

      await expect(increase).toHaveCount(1);
      await expect(box.locator('input')).toHaveCount(0);
      await expect(box.getByTestId('edit-button')).toHaveCount(0);

      await increase.click();
      await increase.click();
      await expect.poll(value).toBe('2');
      await decrease.click();
      await expect.poll(value).toBe('1');

      // Значение уже в листе: повторная загрузка показывает его же.
      await expect
        .poll(async () => {
          const response = await page.request.get('/api/characters');
          const list = (await response.json()) as Array<{
            id: string;
            insanityPoints?: { total: number };
          }>;
          return list.find((character) => character.id === id)?.insanityPoints
            ?.total;
        })
        .toBe(1);

      await page.reload();
      await page
        .locator('[data-testid="insanity-points-increase"]:visible')
        .waitFor();
      await expect
        .poll(() =>
          page
            .locator('[data-testid="insanity-points-increase"]:visible')
            .locator('xpath=..')
            .locator('span')
            .innerText(),
        )
        .toBe('1');

      // Ниже нуля не уходит: на нуле «−» отключена.
      await decrease.click();
      await expect
        .poll(() =>
          page
            .locator('[data-testid="insanity-points-decrease"]:visible')
            .locator('xpath=..')
            .locator('span')
            .innerText(),
        )
        .toBe('0');
      await expect(
        page.locator('[data-testid="insanity-points-decrease"]:visible'),
      ).toBeDisabled();
    },
  );
});
