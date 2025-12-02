/**
 * Tag Color Utilities
 * Provides predefined color palette, random color generation,
 * and color conflict detection for tag management.
 */

export const TAG_COLOR_PALETTE = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Yellow", value: "#eab308" },
  { name: "Lime", value: "#84cc16" },
  { name: "Green", value: "#22c55e" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Slate", value: "#64748b" },
  { name: "Gray", value: "#6b7280" },
  { name: "Zinc", value: "#71717a" },
] as const;

/**
 * Get a random color from the predefined palette
 */
export function getRandomColor(): string {
  const randomIndex = Math.floor(Math.random() * TAG_COLOR_PALETTE.length);
  return TAG_COLOR_PALETTE[randomIndex].value;
}

/**
 * Get a color that doesn't conflict with existing colors
 * Returns a color from the palette that's not already in use,
 * or a random color if all colors are used
 */
export function getNonConflictingColor(existingColors: (string | null)[]): string {
  const usedColors = new Set(existingColors.filter(Boolean));
  const availableColors = TAG_COLOR_PALETTE.filter(
    (color) => !usedColors.has(color.value)
  );

  if (availableColors.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableColors.length);
    return availableColors[randomIndex].value;
  }

  return getRandomColor();
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance of a color
 * Used for accessibility checks
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * WCAG 2.0 requires 4.5:1 for normal text
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return 0;

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Check if a color has sufficient contrast against a background
 */
export function hasGoodContrast(
  foreground: string,
  background: string,
  level: "AA" | "AAA" = "AA"
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return level === "AAA" ? ratio >= 7 : ratio >= 4.5;
}

/**
 * Get appropriate text color (black or white) for a background color
 */
export function getTextColorForBackground(backgroundColor: string): string {
  const whiteContrast = getContrastRatio("#ffffff", backgroundColor);
  const blackContrast = getContrastRatio("#000000", backgroundColor);

  return whiteContrast > blackContrast ? "#ffffff" : "#000000";
}

/**
 * Check if two colors are too similar
 * Returns true if colors are visually too close to each other
 */
export function areColorsSimilar(color1: string, color2: string): boolean {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return false;

  // Calculate Euclidean distance in RGB space
  const distance = Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
  );

  // Threshold for similarity (0-441 scale, where 441 is max distance)
  return distance < 100;
}

/**
 * Find similar colors in a list
 */
export function findSimilarColors(
  targetColor: string,
  existingColors: (string | null)[]
): string[] {
  return existingColors.filter(
    (color) => color && areColorsSimilar(targetColor, color)
  ) as string[];
}

/**
 * Validate if a string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Get color name from palette value
 */
export function getColorName(value: string): string | undefined {
  return TAG_COLOR_PALETTE.find((c) => c.value === value)?.name;
}
