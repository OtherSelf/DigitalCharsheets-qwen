import { expect, test, type Page } from '@playwright/test';

import {
  fetchCharacters,
  openApp,
  openCreationForm,
  prepare,
  registerAccount,
  sheetPath,
  signInViaUI,
  waitForSheetRedirect,
} from '../../../../../tests/visual/helpers';

/**
 * Создание персонажа Dark Heresy 1-й редакции: путь пользователя, дефолты
 * формы и системные поля dh1 (девять характеристик, усталость 1-й редакции,
 * отсутствие influence), плюс игровые регрессии оружия и начисления опыта.
 *
 * Каждый тест работает со СВОИМ аккаунтом (регистрируется через API), поэтому
 * seeded-аккаунт «visual-tests» не трогается.
 */

test.describe(
  'создание персонажа — Dark Heresy',
  { tag: '@plugin:dh1' },
  () => {
    test('форма создаёт лист, данные и системные поля сохраняются', async ({
      page,
      context,
    }) => {
      await prepare(context, { authenticated: false, theme: 'light' });
      const account = await registerAccount(page, 'dh-e2e', 'DH E2E');
      await signInViaUI(page, account);

      await openCreationForm(page, 'darkHeresy', 'dh1');

      const name = 'E2E Acolyte';
      await page.getByLabel('Character Name', { exact: true }).fill(name);

      await page.getByLabel('Home World', { exact: true }).click();
      await page
        .getByRole('option', { name: 'Hive World', exact: true })
        .click();

      await page.getByLabel('Career Path', { exact: true }).click();
      await page.getByRole('option', { name: 'Adept', exact: true }).click();

      // Список пророчеств — фиксированный справочник; берём первый пункт,
      // чтобы тест не зависел от формулировок перевода.
      await page.getByLabel('Divination', { exact: true }).click();
      await page.getByRole('option').first().click();

      await page.getByRole('button', { name: 'Create Character' }).click();

      const id = await waitForSheetRedirect(page);

      // После создания лист один раз открывает «Заметки» с подсказками.
      await expect(
        page.getByRole('heading', { name: 'Creation hints' }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      const characters = await fetchCharacters(page);
      expect(characters, 'ровно один лист у нового аккаунта').toHaveLength(1);

      const created = characters[0];
      expect(created).toMatchObject({
        id,
        name,
        systemId: 'dh1',
        gameSystem: 'Dark Heresy',
        characterClass: 'Adept',
        careerPath: 'Adept',
        homeWorld: 'Hive World',
        // Дефолты формы DH1: минимум диапазона Hive World (1d5+8 → 9–13).
        wounds: { current: 9, max: 9 },
        fatePoints: { current: 1, max: 1 },
        fatigue1st: { current: 0 },
      });
      expect(created.edition, 'поля edition больше нет').toBeUndefined();
      expect(created.fatigue2nd, 'у dh1 нет второй усталости').toBeUndefined();
      expect(created.stats).toMatchObject({
        weaponSkill: 30,
        ballisticSkill: 30,
        strength: 30,
        toughness: 30,
        agility: 30,
        intelligence: 30,
        perception: 30,
        willpower: 30,
        fellowship: 30,
      });
      expect(
        created.stats.influence,
        'influence есть только у dh2',
      ).toBeUndefined();
      expect(created.divination, 'пророчество выбрано').toBeTruthy();
      expect(Object.keys(created.statUpgrades)).toHaveLength(9);
      expect(created.notes, 'подсказки создания уходят в заметки').toContain(
        '# Creation hints',
      );

      // Персонаж виден в дашборде (карточка листа).
      await page.goto('/');
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    });
  },
);

/**
 * ─── LANDMARK: WEAPON ADD REGRESSION ───────────────────────────────────────
 * Кнопку добавления вынесли из аккордеона «Not equipped» (b1b797a), а новый
 * элемент рендерится только в раскрытом контенте: при свёрнутом списке клик
 * выглядел как «ничего не произошло». Проверяем именно ВИДИМОСТЬ поля —
 * проверка через evaluateAll по value прошла бы и для контрола, которого нет
 * в DOM.
 */
test.describe('добавление оружия на листе DH', { tag: '@plugin:dh1' }, () => {
  async function openEmptyEquipment(
    page: Page,
    account: { username: string; password: string },
    systemId: 'dh1' | 'dh2',
    name: string,
  ) {
    const created = await page.request.post('/api/characters', {
      data: { systemId, name },
    });
    expect([200, 201], 'создание пустого листа').toContain(created.status());
    const { id } = (await created.json()) as { id: string };

    await signInViaUI(page, account);
    await openApp(page, sheetPath(id));

    const equipment = page.locator('#equipment-section');
    if (!(await equipment.isVisible().catch(() => false))) {
      // На мобильном секция скрыта за компактной навигацией.
      await page
        .getByRole('button', { name: 'Equipment', exact: true })
        .click();
    }
    await expect(equipment).toBeVisible();
    return equipment;
  }

  async function expectSavedWeapon(
    page: Page,
    slot: 'melee' | 'ranged',
    name: string,
  ) {
    await expect
      .poll(async () => {
        const [character] = await fetchCharacters(page);
        return (character?.equipment?.weapons?.[slot] ?? []).some(
          (weapon: { name: string; equipped: boolean }) =>
            weapon.name === name && weapon.equipped === false,
        );
      })
      .toBe(true);
  }
  test('DH1: новое оружие сразу видно после добавления', async ({
    page,
    context,
  }) => {
    await prepare(context, { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dh1-weapons', 'DH1 Weapons');
    const equipment = await openEmptyEquipment(
      page,
      account,
      'dh1',
      'DH1 Weapons',
    );

    const melee = equipment.getByTestId('melee-weapons');
    await melee.getByTestId('edit-button').click();
    await melee.getByTestId('add-melee-weapon').click();

    // Аккордеон раскрылся, поле нового оружия доступно и видимо.
    await expect(melee.getByTestId('unequipped-melee-trigger')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const newMelee = melee.locator('input').first();
    await expect(newMelee).toBeVisible();
    await expect(newMelee).toHaveValue('New melee weapon');

    await melee.getByTestId('save-button').click();
    await expectSavedWeapon(page, 'melee', 'New melee weapon');

    const ranged = equipment.getByTestId('ranged-weapons');
    await ranged.getByTestId('edit-button').click();
    await ranged.getByTestId('add-ranged-weapon').click();

    await expect(
      ranged.getByTestId('unequipped-ranged-trigger'),
    ).toHaveAttribute('aria-expanded', 'true');
    const newRanged = ranged.locator('input').first();
    await expect(newRanged).toBeVisible();
    await expect(newRanged).toHaveValue('New ranged weapon');

    await ranged.getByTestId('save-button').click();
    await expectSavedWeapon(page, 'ranged', 'New ranged weapon');
  });
});

/**
 * ─── LANDMARK: XP AWARD ───────────────────────────────────────────────────
 * Кнопка «Добавить ОП» рядом со «Spend EXP»: положительное число — награда,
 * отрицательное — штраф. Начисление пишется в журнал опыта и увеличивает
 * `experience`; удаление записи из журнала отменяет начисление ровно на её
 * стоимость.
 */
test.describe('начисление опыта на листе DH', { tag: '@plugin:dh1' }, () => {
  async function openProgression(page: Page) {
    const progression = page.locator('#progression-section');
    if (!(await progression.isVisible().catch(() => false))) {
      await page
        .getByRole('button', { name: 'Progression', exact: true })
        .click();
    }
    await expect(progression).toBeVisible();
    return progression;
  }

  async function awardExp(
    page: Page,
    amount: string,
    note: string,
    labels: { button: string; amount: string; what: string; confirm: string },
  ) {
    await page
      .getByRole('button', { name: labels.button, exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Пресет по умолчанию — 100, поле свободное.
    await expect(dialog.getByLabel(labels.amount)).toHaveValue('100');
    await dialog.getByLabel(labels.amount).fill(amount);
    await dialog.getByLabel(labels.what).fill(note);
    await dialog.getByRole('button', { name: labels.confirm }).click();
    await expect(dialog).toHaveCount(0);
  }

  async function expectExperience(page: Page, expected: number) {
    await expect
      .poll(async () => (await fetchCharacters(page))[0].experience)
      .toBe(expected);
  }
  test('DH1: награда и штраф пишутся в журнал и отменяются', async ({
    page,
  }) => {
    await prepare(page.context(), { authenticated: false, theme: 'light' });
    const account = await registerAccount(page, 'dh1-award', 'DH1 Award');
    const created = await page.request.post('/api/characters', {
      data: { systemId: 'dh1', name: 'DH1 Award' },
    });
    expect([200, 201], 'создание листа').toContain(created.status());
    const { id } = (await created.json()) as { id: string };
    await signInViaUI(page, account);
    await openApp(page, sheetPath(id));
    const progression = await openProgression(page);

    const labels = {
      button: 'Add EXP',
      amount: 'XP amount',
      what: 'What was it for',
      confirm: 'Add',
    };
    const before = (await fetchCharacters(page))[0].experience as number;

    await awardExp(page, '100', 'Session 1', labels);
    await expectExperience(page, before + 100);
    await expect
      .poll(async () =>
        (await fetchCharacters(page))[0].experienceLog.find(
          (entry: { label: string }) => entry.label === 'Session 1',
        ),
      )
      .toMatchObject({ cost: 100, kind: 'award' });

    // Запись видна в журнале опыта.
    await progression
      .getByRole('button', { name: 'XP log', exact: true })
      .click();
    const journal = page.getByRole('dialog');
    await expect(journal.getByText('Session 1')).toBeVisible();
    await expect(journal.getByText('100', { exact: true })).toBeVisible();

    // Удаление записи снимает начисленное.
    await journal.getByRole('button', { name: 'Delete entry' }).click();
    await expectExperience(page, before);
    await page.keyboard.press('Escape');

    // Отрицательное число — штраф; удаление возвращает опыт.
    await awardExp(page, '-50', 'Penalty', labels);
    await expectExperience(page, before - 50);
    await progression
      .getByRole('button', { name: 'XP log', exact: true })
      .click();
    const penaltyJournal = page.getByRole('dialog');
    await expect(penaltyJournal.getByText('Penalty')).toBeVisible();
    await penaltyJournal.getByRole('button', { name: 'Delete entry' }).click();
    await expectExperience(page, before);
  });
});
