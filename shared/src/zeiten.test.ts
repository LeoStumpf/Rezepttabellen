import { describe, it, expect } from 'vitest';
import { findeZeiten, formatRestzeit } from './zeiten.ts';

const zeiten = (t: string) => findeZeiten(t).filter((x) => x.sekunden).map((x) => [x.text, x.sekunden]);

describe('findeZeiten', () => {
  it('erkennt übliche Angaben', () => {
    expect(zeiten('Zwiebeln 10 Minuten glasig dünsten.')).toEqual([['10 Minuten', 600]]);
    expect(zeiten('10–15 Min. köcheln, dann 30 Sekunden rühren')).toEqual([['10–15 Min.', 900], ['30 Sekunden', 30]]);
    expect(zeiten('1½ Std. schmoren')).toEqual([['1½ Std.', 5400]]);
    expect(zeiten('2 h ziehen lassen')).toEqual([['2 h', 7200]]);
    expect(zeiten('eine halbe Stunde ruhen, dann noch eine Minute')).toEqual([['eine halbe Stunde', 1800], ['eine Minute', 60]]);
    expect(zeiten('5-8 min backen')).toEqual([['5-8 min', 480]]);
    expect(zeiten('1,5 Stunden')).toEqual([['1,5 Stunden', 5400]]);
  });
  it('lässt anderes in Ruhe und behält den Text', () => {
    expect(zeiten('200 g Mehl, 2 Eier, minimal salzen, Hähnchen')).toEqual([]);
    expect(zeiten('Ofen auf 180 Grad')).toEqual([]);
    const t = 'Erst 5 Minuten braten, dann servieren.';
    expect(findeZeiten(t).map((x) => x.text).join('')).toBe(t);
  });
  it('formatRestzeit', () => {
    expect(formatRestzeit(90)).toBe('1:30');
    expect(formatRestzeit(3700)).toBe('1:01:40');
    expect(formatRestzeit(-3)).toBe('0:00');
  });
});
