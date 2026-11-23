import { qrcodegen } from './qr-codegen';

/**
 * QR для `otpauth://`-URI: SVG в data-URL, без внешних сервисов и картинок.
 * Секрет не должен уходить третьей стороне, поэтому кодирование локальное.
 * Уровень коррекции M — разумный баланс размера и устойчивости к бликам.
 */
export function qrSvgDataUrl(text: string): string {
  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM);
  const margin = 4;
  const dimension = qr.size + margin * 2;
  const parts: string[] = [];
  // Горизонтальные полосы вместо модуля-на-модуль: SVG и data-URL заметно
  // короче, а картинка та же.
  for (let y = 0; y < qr.size; y += 1) {
    let runStart = -1;
    for (let x = 0; x <= qr.size; x += 1) {
      const dark = x < qr.size && qr.getModule(x, y);
      if (dark && runStart === -1) runStart = x;
      if (!dark && runStart !== -1) {
        const length = x - runStart;
        parts.push(
          `M${runStart + margin},${y + margin}h${length}v1h-${length}z`,
        );
        runStart = -1;
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" ` +
    `role="img" shape-rendering="crispEdges">` +
    `<rect width="${dimension}" height="${dimension}" fill="#ffffff"/>` +
    `<path d="${parts.join('')}" fill="#000000"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}
