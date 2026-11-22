import { describe, expect, it } from 'vitest';

import { safeInternalPath } from '@/lib/routes';

describe('safeInternalPath', () => {
  it('пропускает внутренние пути', () => {
    expect(safeInternalPath('/character/abc')).toBe('/character/abc');
    expect(safeInternalPath('/settings?from=/')).toBe('/settings?from=/');
  });

  it('не пускает protocol-relative и обратные слэши', () => {
    expect(safeInternalPath('//evil.example')).toBe('/');
    expect(safeInternalPath('/\\evil.example')).toBe('/');
    expect(safeInternalPath('https://evil.example')).toBe('/');
    expect(safeInternalPath(null)).toBe('/');
  });
});
