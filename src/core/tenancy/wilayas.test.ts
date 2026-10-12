import { describe, expect, it } from 'vitest';
import { WILAYAS, WILAYA_CODE_PATTERN, WILAYA_CODE_RE, isWilayaCode } from './wilayas';

describe('wilayas', () => {
  it('lists the 69 wilayas with unique, consecutive two-digit codes', () => {
    expect(WILAYAS).toHaveLength(69);
    expect(WILAYAS.map((w) => w.code)).toEqual(Array.from({ length: 69 }, (_, i) => String(i + 1).padStart(2, '0')));
    expect(new Set(WILAYAS.map((w) => w.name)).size).toBe(69);
  });

  it('has the eleven wilayas created by law 26-06 under codes 59 to 69', () => {
    const created = WILAYAS.slice(58).map((w) => `${w.code} ${w.name}`);
    expect(created).toEqual([
      '59 Aflou', '60 Barika', '61 El Kantara', '62 Bir El Ater', '63 El Aricha', '64 Ksar Chellala',
      '65 Aïn Oussara', '66 Messaad', '67 Ksar El Boukhari', '68 Bou Saâda', '69 El Abiodh Sidi Cheikh',
    ]);
  });

  it('validates exactly the listed codes', () => {
    for (const w of WILAYAS) {
      expect(isWilayaCode(w.code)).toBe(true);
      expect(WILAYA_CODE_RE.test(w.code)).toBe(true);
    }
    for (const bad of ['00', '70', '5', '059', 'ab', '']) {
      expect(isWilayaCode(bad)).toBe(false);
      expect(WILAYA_CODE_RE.test(bad)).toBe(false);
    }
  });

  it('exposes the same set as an HTML pattern', () => {
    const html = new RegExp(`^(?:${WILAYA_CODE_PATTERN})$`);
    expect(html.test('69')).toBe(true);
    expect(html.test('70')).toBe(false);
  });
});
