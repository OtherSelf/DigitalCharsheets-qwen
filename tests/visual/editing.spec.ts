import { expect, test, type Locator } from '@playwright/test';

import {
  discardUnsavedChanges,
  getState,
  openApp,
  openMobileSection,
  prepare,
  screenshotElement,
  screenshotPage,
  sheetPath,
  signInViaUI,
} from './helpers';

/**
 * Режим редактирования: проверяем не только то, что кнопка Edit существует,
 * но и то, что поля открываются ЗАПОЛНЕННЫМИ данными персонажа.
 *
 * Клик по Edit меняет только локальный state — в API ничего не уходит,
 * поэтому тесты не портят фикстуры. Сохранение (Save) не нажимаем.
 */

async function startEditing(scope: Locator): Promise<void> {
  await scope.locator('[data-testid="edit-button"]:visible').first().click();
  await expect(scope.getByTestId('save-button').first()).toBeVisible();
}

/**
 * Включает редактирование сразу во всех карточках секции (например, у
 * заклинаний Edit есть у каждого уровня). Иначе поля Fireball/Shield
 * остались бы в режиме чтения.
 */
async function startEditingAll(scope: Locator): Promise<void> {
  const buttons = scope.locator('[data-testid="edit-button"]:visible');
  for (let guard = 0; guard < 24; guard += 1) {
    if ((await buttons.count()) === 0) break;
    await buttons.first().click();
  }
  await expect(scope.getByTestId('save-button').first()).toBeVisible();
}

/** Проверяет, что среди input-полей секции есть поле с указанным значением. */
async function expectInputValue(scope: Locator, value: string): Promise<void> {
  await expect
    .poll(() =>
      scope
        .locator('input')
        .evaluateAll(
          (inputs, expected) =>
            inputs.some(
              (input) => (input as HTMLInputElement).value === expected,
            ),
          value,
        ),
    )
    .toBe(true);
}

test.describe('редактирование D&D', () => {
  test(
    'desktop: прогрессия, инфо, статы, спасброски, навыки (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      // Высокий вьюпорт, чтобы элементные скриншоты длинных карточек
      // (статы, навыки, характеристики DH) снимались целиком.
      await page.setViewportSize({ width: 1920, height: 1600 });
      await prepare(context);
      await openApp(page, sheetPath(getState().dndId));

      const progression = page.locator('#progression-section:visible').first();
      await startEditing(progression);
      await screenshotElement(progression, 'sheet-dnd-edit-progression-en.png');

      const info = page.locator('#character-info-card:visible').first();
      await startEditing(info);
      await screenshotElement(info, 'sheet-dnd-edit-info-en.png');

      // Характеристики: 6 числовых полей с примерными значениями.
      const stats = page.locator('#stats-card:visible').first();
      await startEditing(stats);
      const statInputs = stats.locator('input[type="number"]');
      await expect(statInputs).toHaveCount(6);
      await expect(statInputs.nth(0)).toHaveValue('8');
      await expect(statInputs.nth(3)).toHaveValue('18');
      await screenshotElement(stats, 'sheet-dnd-edit-stats-en.png');

      const saves = page.locator('#saving-throws-card:visible').first();
      await startEditing(saves);
      await expect(saves.locator('input[type="number"]')).toHaveCount(6);
      await expect(saves.locator('input[type="number"]').first()).toHaveValue(
        '',
      );
      await screenshotElement(saves, 'sheet-dnd-edit-saves-en.png');

      // Навыки: поля ручных модификаторов (у Arcana +2, у History +1).
      const skills = page.locator('#skills-card:visible').first();
      await startEditing(skills);
      await expect(skills.locator('input[type="number"]').nth(2)).toHaveValue(
        '2',
      );
      await expect(skills.locator('input[type="number"]').nth(5)).toHaveValue(
        '1',
      );
      await screenshotElement(skills, 'sheet-dnd-edit-skills-en.png');
    },
  );

  test(
    'desktop: бой, атаки, инвентарь, настройка (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1600 });
      await prepare(context);
      await openApp(page, sheetPath(getState().dndId));

      const combat = page.locator('#hit-points-card:visible').first();
      await startEditing(combat);
      await expect(combat.locator('input[type="number"]').first()).toHaveValue(
        '45',
      );
      await screenshotElement(combat, 'sheet-dnd-edit-combat-en.png');

      const attacks = page
        .locator('#attacks-and-spellcasting-box:visible')
        .first();
      await startEditing(attacks);
      await expectInputValue(attacks, 'Fire Bolt');
      await screenshotElement(attacks, 'sheet-dnd-edit-attacks-en.png');

      // Инвентарь: деньги и предметы (Spellbook и т.д.).
      const inventory = page.locator('#inventory-box:visible').first();
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click(); // деньги
      await expect(inventory.locator('input[type="number"]')).toHaveCount(5);
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click(); // предметы
      await expectInputValue(inventory, 'Spellbook');
      await expect(
        inventory.locator('input[type="number"]').nth(3),
      ).toHaveValue('245');
      await screenshotElement(inventory, 'sheet-dnd-edit-inventory-en.png');

      const attunement = page.locator('#attunement-card:visible').first();
      await startEditing(attunement);
      await expectInputValue(attunement, 'Cloak of Protection');
      await screenshotElement(attunement, 'sheet-dnd-edit-attunement-en.png');
    },
  );

  test(
    'desktop: заклинания, спутники, нарратив (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1600 });
      await prepare(context);
      await openApp(page, sheetPath(getState().dndId));

      const spells = page.locator('#spells-section:visible').first();
      await startEditingAll(spells);
      await expectInputValue(spells, 'Shield');
      await screenshotElement(spells, 'sheet-dnd-edit-spells-en.png');

      const companions = page.locator('#companions-section:visible').first();
      await startEditing(companions);
      await expectInputValue(companions, 'Ember');
      await screenshotElement(companions, 'sheet-dnd-edit-companions-en.png');

      const narrative = page.locator('#narrative-section:visible').first();
      await startEditing(narrative);
      await expectInputValue(
        narrative,
        'I quote obscure texts at every opportunity.',
      );
      await screenshotElement(narrative, 'sheet-dnd-edit-narrative-en.png');
    },
  );

  test(
    'mobile: статы, навыки, инвентарь (en)',
    { tag: '@mobile' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(getState().dndId));

      // Компактная плашка статов: карандаш в правом верхнем углу.
      const statsBar = page.getByTestId('compact-stats-bar');
      await statsBar.getByTestId('compact-stats-edit-button').click();
      await expect(statsBar.locator('input[type="number"]')).toHaveCount(6);
      await screenshotPage(page, 'sheet-dnd-mobile-edit-stats-en.png');

      await openMobileSection(page, 'Ability Scores');
      await discardUnsavedChanges(page);
      const skills = page.locator('#skills-card:visible').first();
      await startEditing(skills);
      await expect(skills.locator('input[type="number"]').nth(2)).toHaveValue(
        '2',
      );
      await screenshotPage(page, 'sheet-dnd-mobile-edit-skills-en.png');

      await openMobileSection(page, 'Inventory & Attunement');
      await discardUnsavedChanges(page);
      const inventory = page.locator('#inventory-box:visible').first();
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click();
      await inventory
        .locator('[data-testid="edit-button"]:visible')
        .first()
        .click();
      await expectInputValue(inventory, 'Spellbook');
      await screenshotPage(page, 'sheet-dnd-mobile-edit-inventory-en.png');
    },
  );
});

test.describe('редактирование Dark Heresy', () => {
  test(
    'desktop: инфо, прогрессия, характеристики (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1600 });
      await prepare(context);
      await openApp(page, sheetPath(getState().dhId));

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
      await openApp(page, sheetPath(getState().dhId));

      // Навыки: имена и тренировки открываются в виде полей ввода.
      const skills = page.locator('#skills-talents-panel:visible').first();
      await startEditing(skills);
      await expectInputValue(skills, 'Awareness (Per)');
      await expectInputValue(skills, 'Scholastic Lore (Int)');
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
      await openApp(page, sheetPath(getState().dhId));

      const characteristics = page.getByTestId('characteristics-compact');
      await startEditing(characteristics);
      await expect(
        characteristics.locator('input[type="number"]').nth(0),
      ).toHaveValue('34');
      await screenshotPage(page, 'sheet-dh-mobile-edit-characteristics-en.png');

      await openMobileSection(page, 'Skills');
      const skills = page.locator('#skills-talents-content:visible').first();
      await startEditing(skills);
      await expectInputValue(skills, 'Awareness (Per)');
      await screenshotPage(page, 'sheet-dh-mobile-edit-skills-en.png');
    },
  );
});

/**
 * ─── LANDMARK: CREATION EDIT POLICY ────────────────────────────────────────
 * Двухуровневая политика (D4): описательные поля редактируются всегда,
 * creation-поля — только пока пустые. Заполненный мир/роль/пророчество
 * read-only с замком «выбрано при создании». Производные не пересчитываются
 * (D15), поэтому тест проверяет только сам факт записи поля.
 */
test.describe('политика редактирования после создания', () => {
  const LOCK_HINT = 'Chosen at creation — recreate the character to change it.';

  test(
    'DH1: заданные creation-поля только читаются (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      await openApp(page, sheetPath(getState().dhId));

      const info = page.locator('#info-section:visible').first();
      await startEditing(info);

      // Фикстура задаёт homeWorld, worldVariant, careerPath и divination.
      await expect(info.getByTestId('creation-lock')).toHaveCount(4);
      // Подсказка локализована и доступна скринридеру.
      await expect(info.getByTestId('creation-lock').first()).toHaveAttribute(
        'aria-label',
        LOCK_HINT,
      );
      await expect(info.getByText('Imperial World')).toBeVisible();
      await expect(info.getByText('Shrine World')).toBeVisible();
      // Выбора нет даже в режиме правки: смена мира — только пересозданием.
      await expect(info.getByRole('combobox')).toHaveCount(0);
    },
  );

  test(
    'DH2: пустое creation-поле заполняется и блокируется (en)',
    { tag: '@desktop' },
    async ({ page }) => {
      // Свежий лист dh2 без creation-полей: фикстуры визуальных тестов
      // не трогаем, иначе поедут эталоны листа.
      const username = `policy-dh2-${Date.now()}`;
      const password = 'policy-password-1';
      const registered = await page.request.post('/api/auth/register', {
        data: {
          username,
          password,
          displayName: 'Policy DH2',
          recoveryPhrase: 'amber cobalt lantern',
        },
      });
      expect([200, 201], 'регистрация аккаунта').toContain(registered.status());

      const created = await page.request.post('/api/characters', {
        data: { systemId: 'dh2', name: 'Policy DH2' },
      });
      expect([200, 201], 'создание пустого dh2-листа').toContain(
        created.status(),
      );
      const { id } = (await created.json()) as { id: string };

      await signInViaUI(page, { username, password });
      await openApp(page, sheetPath(id));

      const info = page.locator('#info-section:visible').first();
      await startEditing(info);

      // Пустое поле открывает выбор; заполняем мир.
      const homeWorld = info.getByRole('combobox', { name: 'Home World' });
      await expect(homeWorld).toBeVisible();
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/characters/${id}`) &&
          response.request().method() === 'PUT',
      );
      await homeWorld.click();
      await page.getByRole('option', { name: 'Feral World' }).click();
      await saved;
      await expect(
        info.getByText('Feral World', { exact: true }),
      ).toBeVisible();

      // Gender — описательное поле: input доступен в правке.
      await expect(info.getByLabel('Gender')).toBeVisible();

      await info.getByTestId('save-button').first().click();
      await openApp(page, sheetPath(id));

      const reloaded = page.locator('#info-section:visible').first();
      await startEditing(reloaded);
      // Мир задан: выбор исчез, появился замок «выбрано при создании».
      await expect(
        reloaded.getByRole('combobox', { name: 'Home World' }),
      ).toHaveCount(0);
      await expect(reloaded.getByTestId('creation-lock')).toHaveCount(1);
      await expect(
        reloaded.getByText('Feral World', { exact: true }),
      ).toBeVisible();
    },
  );
});

/**
 * ─── LANDMARK: CONDITIONS CRUD ─────────────────────────────────────────────
 * Список состояний (D7): добавление только в режиме правки, запись через
 * `updateCharacter`, просмотр — в режиме чтения. Исходные текстовые поля
 * (mutations/disorders/defilements) в UI больше не дублируются.
 */
test.describe('состояния Безумия/Порчи', () => {
  test(
    'DH1: добавить, сохранить и удалить состояние (en)',
    { tag: '@desktop' },
    async ({ page, context }) => {
      await prepare(context);
      const id = getState().dhId;
      await openApp(page, sheetPath(id));

      const info = page.locator('#info-section:visible').first();
      await startEditing(info);

      const before = await info.getByTestId('condition-entry').count();
      await info.getByRole('button', { name: 'Add condition' }).click();
      await expect(info.getByTestId('condition-entry')).toHaveCount(before + 1);

      const entry = info.getByTestId('condition-entry').last();
      const inputs = entry.locator('input');
      await inputs.nth(0).fill('Проверка состояния');
      await inputs.nth(1).fill('2');
      await entry.locator('textarea').fill('Заметка');

      // Ждём PUT, в котором уже есть и название, и заметка: очередь
      // склеивает патчи, поэтому ориентируемся на тело запроса.
      await page.waitForResponse((response) => {
        if (!response.url().includes(`/api/characters/${id}`)) return false;
        if (response.request().method() !== 'PUT') return false;
        const body = response.request().postData() ?? '';
        return body.includes('Проверка состояния') && body.includes('Заметка');
      });

      await info.getByTestId('save-button').first().click();
      await openApp(page, sheetPath(id));

      const reloaded = page.locator('#info-section:visible').first();
      await expect(reloaded.getByText('Проверка состояния')).toBeVisible();
      await expect(reloaded.getByText('Disorder')).toBeVisible();

      await startEditing(reloaded);
      const stored = reloaded.getByTestId('condition-entry').last();
      await stored.getByRole('button', { name: 'Remove condition' }).click();
      await page.waitForResponse((response) => {
        if (!response.url().includes(`/api/characters/${id}`)) return false;
        if (response.request().method() !== 'PUT') return false;
        return !(response.request().postData() ?? '').includes(
          'Проверка состояния',
        );
      });

      await reloaded.getByTestId('save-button').first().click();
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
