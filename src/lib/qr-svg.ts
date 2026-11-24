import { qrcodegen } from './qr-codegen';

/**
 * QR для `otpauth://`-URI: SVG в data-URL, без внешних сервисов и картинок.
 * Секрет не должен уходить третьей стороне, поэтому кодирование локальное.
 * Уровень коррекции M — разумный баланс размера и устойчивости к бликам.
 */
export interface QrSvgOptions {
  /** Цвет модулей; не чисто чёрный, чтобы код выглядел мягче в теме. */
  dark?: string;
  /** Цвет фона и тихой зоны. */
  light?: string;
}

export function qrSvgDataUrl(text: string, options: QrSvgOptions = {}): string {
  const dark = options.dark ?? '#1f2937';
  const light = options.light ?? '#ffffff';
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
    `<rect width="${dimension}" height="${dimension}" fill="${light}"/>` +
    `<path d="${parts.join('')}" fill="${dark}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}
