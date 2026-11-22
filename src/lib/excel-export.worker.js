/**
 * ─── LANDMARK: EXCEL WORKER ────────────────────────────────────────────────
 * Сборка xlsx вынесена из главного потока: SheetJS синхронно сериализует
 * книгу и на большом листе подвешивает UI. Воркер получает готовые строки
 * (переводы и нормализация остаются в основном потоке, где есть плагины) и
 * возвращает ArrayBuffer; скачивание делает главный поток через Blob.
 *
 * Node worker_threads здесь не подходит: экспорт вызывается в браузере.
 */
// SheetJS кладётся рядом с приложением (public/vendor), а не импортируется
// в воркер: Turbopack не бандлит воркер-модуль, а classic-воркер с
// importScripts работает в любом браузере и не зависит от резолва bare-import.
self.importScripts('/vendor/xlsx/xlsx.full.min.js');

self.onmessage = (event) => {
  try {
    const { rows, sheetName, columns } = event.data;
    const XLSX = self.XLSX;
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = columns;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    self.postMessage({ ok: true, buffer });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'Excel export failed.',
    });
  }
};
