import { describe, expect, it } from 'vitest';

import { qrSvgDataUrl } from '@/lib/qr-svg';

const URI =
  'otpauth://totp/Digital%20Character%20Sheets:hero%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Digital%20Character%20Sheets&algorithm=SHA1&digits=6&period=30';

describe('QR для otpauth-URI', () => {
  it('отдаёт SVG data-URL с тихим полем и дорожками', () => {
    const url = qrSvgDataUrl(URI);
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);

    const svg = Buffer.from(url.split(',')[1], 'base64').toString('utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<path d="M');
    // Тихая зона 4 модуля с каждой стороны: viewBox больше матрицы QR.
    const viewBox = /viewBox="0 0 (\d+) \d+"/.exec(svg);
    expect(viewBox).not.toBeNull();
    expect(Number(viewBox![1])).toBeGreaterThan(21);
  });

  it('разный текст даёт разные QR', () => {
    expect(qrSvgDataUrl(URI)).not.toBe(
      qrSvgDataUrl(URI.replace('SHA1', 'SHA256')),
    );
  });

  it('кодирует длинный URI без внешних сервисов', () => {
    const url = qrSvgDataUrl(`${URI}&extra=${'x'.repeat(200)}`);
    expect(url.length).toBeGreaterThan(1000);
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });
});
