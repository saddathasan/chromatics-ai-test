import { describe, expect, it } from 'vitest';
import { GLOSSARY, GUIDE_SECTIONS } from './glossary';

describe('glossary', () => {
  it('gives every term both registers: a line for the tip and a passage for the guide', () => {
    for (const [key, term] of Object.entries(GLOSSARY)) {
      expect(term.label, key).toBeTruthy();
      expect(term.short.length, key).toBeGreaterThan(20);
      expect(term.full.length, key).toBeGreaterThan(0);
    }
  });

  it('files every term under a section the guide actually renders', () => {
    const sections = new Set(GUIDE_SECTIONS.map((s) => s.id));
    for (const [key, term] of Object.entries(GLOSSARY)) {
      expect(sections.has(term.section), `${key} → ${term.section}`).toBe(true);
    }
  });

  it('keeps the tip short enough to read in a hover', () => {
    // A tooltip is a glance. Anything longer belongs in the passage behind "Read more".
    for (const [key, term] of Object.entries(GLOSSARY)) {
      expect(term.short.length, key).toBeLessThan(220);
    }
  });
});
