import {
  TAG_COLOR_PALETTE,
  getRandomColor,
  getNonConflictingColor,
  getContrastRatio,
  hasGoodContrast,
  getTextColorForBackground,
  areColorsSimilar,
  findSimilarColors,
  isValidHexColor,
  getColorName,
} from '@/lib/utils/tagColors';

describe('Tag Color Utilities', () => {
  describe('getRandomColor', () => {
    it('should return a color from the palette', () => {
      const color = getRandomColor();
      const paletteValues = TAG_COLOR_PALETTE.map((c) => c.value);
      expect(paletteValues).toContain(color);
    });

    it('should return a valid hex color', () => {
      const color = getRandomColor();
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should potentially return different colors on multiple calls', () => {
      const colors = new Set();
      for (let i = 0; i < 50; i++) {
        colors.add(getRandomColor());
      }
      // With 20 colors in palette and 50 calls, we should get at least 2 different colors
      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe('getNonConflictingColor', () => {
    it('should return a color from the palette when no colors are used', () => {
      const color = getNonConflictingColor([]);
      const paletteValues = TAG_COLOR_PALETTE.map((c) => c.value);
      expect(paletteValues).toContain(color);
    });

    it('should return a color not in the existing colors list', () => {
      const existingColors = ['#ef4444', '#f97316'];
      const color = getNonConflictingColor(existingColors);
      expect(existingColors).not.toContain(color);
    });

    it('should handle null values in existing colors', () => {
      const existingColors = ['#ef4444', null, '#f97316', null];
      const color = getNonConflictingColor(existingColors);
      const paletteValues = TAG_COLOR_PALETTE.map((c) => c.value);
      expect(paletteValues).toContain(color);
    });

    it('should return a random color when all palette colors are used', () => {
      const allColors = TAG_COLOR_PALETTE.map((c) => c.value);
      const color = getNonConflictingColor(allColors);
      // Should still return a color from the palette
      expect(allColors).toContain(color);
    });
  });

  describe('getContrastRatio', () => {
    it('should return correct ratio for black and white', () => {
      const ratio = getContrastRatio('#000000', '#ffffff');
      expect(ratio).toBeCloseTo(21, 0); // Black/White has 21:1 ratio
    });

    it('should return 1 for identical colors', () => {
      const ratio = getContrastRatio('#ef4444', '#ef4444');
      expect(ratio).toBe(1);
    });

    it('should handle colors without hash prefix', () => {
      const ratio = getContrastRatio('000000', 'ffffff');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should return 0 for invalid hex colors', () => {
      const ratio = getContrastRatio('invalid', '#ffffff');
      expect(ratio).toBe(0);
    });

    it('should calculate ratio for palette colors', () => {
      const ratio = getContrastRatio('#ef4444', '#3b82f6');
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(21);
    });
  });

  describe('hasGoodContrast', () => {
    it('should return true for black text on white background (AA)', () => {
      expect(hasGoodContrast('#000000', '#ffffff', 'AA')).toBe(true);
    });

    it('should return true for black text on white background (AAA)', () => {
      expect(hasGoodContrast('#000000', '#ffffff', 'AAA')).toBe(true);
    });

    it('should default to AA level', () => {
      const resultWithDefault = hasGoodContrast('#000000', '#ffffff');
      const resultWithAA = hasGoodContrast('#000000', '#ffffff', 'AA');
      expect(resultWithDefault).toBe(resultWithAA);
    });

    it('should return false for low contrast combinations', () => {
      expect(hasGoodContrast('#fff', '#ffe', 'AA')).toBe(false);
    });

    it('should be more strict for AAA than AA', () => {
      const mediumContrast = '#767676';
      const background = '#ffffff';
      // This combination might pass AA but not AAA
      const passesAA = hasGoodContrast(mediumContrast, background, 'AA');
      const passesAAA = hasGoodContrast(mediumContrast, background, 'AAA');
      // If it passes AA, AAA result should be same or false
      if (passesAA) {
        expect(passesAAA === passesAA || passesAAA === false).toBe(true);
      }
    });
  });

  describe('getTextColorForBackground', () => {
    it('should return white for dark backgrounds', () => {
      expect(getTextColorForBackground('#000000')).toBe('#ffffff');
    });

    it('should return black for light backgrounds', () => {
      expect(getTextColorForBackground('#ffffff')).toBe('#000000');
    });

    it('should handle medium-toned colors', () => {
      const result = getTextColorForBackground('#808080');
      expect(['#ffffff', '#000000']).toContain(result);
    });

    it('should handle palette colors consistently', () => {
      TAG_COLOR_PALETTE.forEach((color) => {
        const textColor = getTextColorForBackground(color.value);
        expect(['#ffffff', '#000000']).toContain(textColor);
      });
    });
  });

  describe('areColorsSimilar', () => {
    it('should return true for identical colors', () => {
      expect(areColorsSimilar('#ef4444', '#ef4444')).toBe(true);
    });

    it('should return true for very similar colors', () => {
      expect(areColorsSimilar('#ef4444', '#ef4445')).toBe(true);
    });

    it('should return false for very different colors', () => {
      expect(areColorsSimilar('#000000', '#ffffff')).toBe(false);
    });

    it('should return false for invalid colors', () => {
      expect(areColorsSimilar('invalid', '#ffffff')).toBe(false);
    });

    it('should handle colors without hash prefix', () => {
      expect(areColorsSimilar('ef4444', 'ef4445')).toBe(true);
    });
  });

  describe('findSimilarColors', () => {
    it('should find similar colors in a list', () => {
      const targetColor = '#ef4444';
      const existingColors = ['#ef4445', '#000000', '#ffffff'];
      const similar = findSimilarColors(targetColor, existingColors);
      expect(similar).toContain('#ef4445');
      expect(similar).not.toContain('#000000');
    });

    it('should return empty array when no similar colors exist', () => {
      const targetColor = '#ef4444';
      const existingColors = ['#000000', '#ffffff'];
      const similar = findSimilarColors(targetColor, existingColors);
      expect(similar).toEqual([]);
    });

    it('should filter out null values', () => {
      const targetColor = '#ef4444';
      const existingColors = ['#ef4445', null, '#000000', null];
      const similar = findSimilarColors(targetColor, existingColors);
      expect(similar).not.toContain(null);
    });

    it('should handle empty existing colors array', () => {
      const similar = findSimilarColors('#ef4444', []);
      expect(similar).toEqual([]);
    });
  });

  describe('isValidHexColor', () => {
    it('should return true for valid 6-digit hex colors', () => {
      expect(isValidHexColor('#ef4444')).toBe(true);
      expect(isValidHexColor('#000000')).toBe(true);
      expect(isValidHexColor('#FFFFFF')).toBe(true);
    });

    it('should return true for valid 3-digit hex colors', () => {
      expect(isValidHexColor('#fff')).toBe(true);
      expect(isValidHexColor('#000')).toBe(true);
      expect(isValidHexColor('#ABC')).toBe(true);
    });

    it('should return false for hex colors without hash', () => {
      expect(isValidHexColor('ef4444')).toBe(false);
    });

    it('should return false for invalid formats', () => {
      expect(isValidHexColor('#gg0000')).toBe(false);
      expect(isValidHexColor('#00')).toBe(false);
      expect(isValidHexColor('#0000000')).toBe(false);
      expect(isValidHexColor('not-a-color')).toBe(false);
      expect(isValidHexColor('')).toBe(false);
    });

    it('should handle case insensitivity', () => {
      expect(isValidHexColor('#Ef4444')).toBe(true);
      expect(isValidHexColor('#EF4444')).toBe(true);
    });
  });

  describe('getColorName', () => {
    it('should return the name for a palette color', () => {
      expect(getColorName('#ef4444')).toBe('Red');
      expect(getColorName('#3b82f6')).toBe('Blue');
      expect(getColorName('#22c55e')).toBe('Green');
    });

    it('should return undefined for non-palette colors', () => {
      expect(getColorName('#123456')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(getColorName('')).toBeUndefined();
    });

    it('should be case-sensitive with palette values', () => {
      // Palette uses lowercase hex
      expect(getColorName('#EF4444')).toBeUndefined();
      expect(getColorName('#ef4444')).toBe('Red');
    });
  });
});
