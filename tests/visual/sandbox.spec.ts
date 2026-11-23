import { expect, test } from '@playwright/test';

import { openApp, prepare, sheetPath } from './helpers';

test.describe('Sandbox: мобильный лист', () => {
  test(
    'навигация ведёт к секции, поля редактируются',
    { tag: '@mobile' },
    async ({ page, context }) => {
      const warnings: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'warning') warnings.push(message.text());
      });

      await prepare(context, { account: 'sandboxAdmin' });
      const created = await page.request.post('/api/characters', {
        data: { systemId: 'sandbox', name: 'Sandbox Mobile' },
      });
      expect([200, 201]).toContain(created.status());
      const { id } = (await created.json()) as { id: string };

      try {
        await openApp(page, sheetPath(id));
        await expect(page.getByTestId('sandbox-sheet')).toBeVisible();

        const nav = page.getByRole('navigation');
        await nav
          .getByRole('button', { name: 'Sandbox sheet', exact: true })
          .click();
        await expect(page.locator('#info-section')).toHaveCount(1);
        expect(warnings.join(' ')).not.toContain('[sheet]');

        const rank = page.getByLabel('Rank', { exact: true });
        const notes = page.getByRole('textbox', { name: 'Notes', exact: true });
        // По умолчанию режим редактирования включён; переключатель в рейле
        // должен запирать оба поля, как это делают кнопки реальных редакций.
        await expect(rank).not.toHaveAttribute('readonly', '');
        await nav
          .getByRole('button', { name: 'Edit Buttons', exact: true })
          .click();
        await expect(rank).toHaveAttribute('readonly', '');
        await expect(notes).toHaveAttribute('readonly', '');
        await nav
          .getByRole('button', { name: 'Edit Buttons', exact: true })
          .click();
        await expect(rank).not.toHaveAttribute('readonly', '');
      } finally {
        await page.request.delete(`/api/characters/${id}`);
      }
    },
  );
});
