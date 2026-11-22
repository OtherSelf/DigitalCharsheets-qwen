import { test } from 'vitest';
import * as XLSX from 'xlsx';

/**
 * Стоимость сериализации книги, которую Web Worker уносит с главного потока.
 * Строки готовит основной поток (переводы/плагины), воркер делает только
 * `XLSX.write`; здесь измеряется именно эта часть.
 */
function rows(count: number): (string | number)[][] {
  return Array.from({ length: count }, (_, index) => [
    `Строка ${index + 1}`,
    index,
    `Описание ${index}`,
    index % 2 === 0 ? 'да' : 'нет',
  ]);
}

function workbook(count: number) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows(count));
  worksheet['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 40 }, { wch: 10 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, worksheet, 'Персонаж');
  return book;
}

test('XLSX.write', async ({ bench }) => {
  const book = workbook(1000);
  await bench('1000 строк × 4 колонки', () => {
    XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  }).run();
});
