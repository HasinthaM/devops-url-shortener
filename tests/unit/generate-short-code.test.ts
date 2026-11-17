import { generateShortCode } from '../../src/utils/generate-short-code';

describe('generateShortCode', () => {
  it('should generate a code with default length of 7', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(7);
  });

  it('should generate a code with custom specified length', () => {
    const code = generateShortCode(12);
    expect(code).toHaveLength(12);
  });

  it('should only contain URL-friendly Base62 characters', () => {
    const code = generateShortCode(50);
    expect(code).toMatch(/^[0-9a-zA-Z]+$/);
  });

  it('should generate unique values across 1000 generations', () => {
    const set = new Set<string>();
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      set.add(generateShortCode(8));
    }
    expect(set.size).toBe(iterations);
  });

  it('should throw an error if length is zero or negative', () => {
    expect(() => generateShortCode(0)).toThrow('Short code length must be greater than zero');
    expect(() => generateShortCode(-5)).toThrow('Short code length must be greater than zero');
  });
});
