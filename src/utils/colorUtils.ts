/**
 * Adjusts a hex color by a given percentage
 * @param hexColor Hex color string (with or without #)
 * @param percent Decimal value: positive to lighten, negative to darken
 * @returns Adjusted hex color string with #
 */
export function adjustColor(hexColor: string, percent: number): string {
    // Remove # if present
    const hex = hexColor.replace("#", "");

    // Convert to RGB
    let r = Number.parseInt(hex.substring(0, 2), 16);
    let g = Number.parseInt(hex.substring(2, 4), 16);
    let b = Number.parseInt(hex.substring(4, 6), 16);

    // Adjust the color
    r = Math.min(255, Math.max(0, Math.round(r + r * percent)));
    g = Math.min(255, Math.max(0, Math.round(g + g * percent)));
    b = Math.min(255, Math.max(0, Math.round(b + b * percent)));

    // Convert back to hex
    const newHex = r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");

    return `#${newHex}`;
}

/**
 * Converts a hex color to RGB values
 * @param hexColor Hex color string (with or without #)
 * @returns Object with r, g, b values
 */
export function hexToRgb(hexColor: string): { r: number; g: number; b: number } {
    const hex = hexColor.replace("#", "");
    const r = Number.parseInt(hex.substring(0, 2), 16);
    const g = Number.parseInt(hex.substring(2, 4), 16);
    const b = Number.parseInt(hex.substring(4, 6), 16);
    return { r, g, b };
}

/**
 * Converts RGB values to HSL
 * @param r Red (0-255)
 * @param g Green (0-255)
 * @param b Blue (0-255)
 * @returns Object with h, s, l values
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case rNorm:
                h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
                break;
            case gNorm:
                h = (bNorm - rNorm) / d + 2;
                break;
            case bNorm:
                h = (rNorm - gNorm) / d + 4;
                break;
        }

        h /= 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Converts HSL values to RGB color string
 * @param h Hue (0-360)
 * @param s Saturation (0-100)
 * @param l Lightness (0-100)
 * @returns RGB color string
 */
export function hslToRgb(h: number, s: number, l: number): string {
    const sNorm = s / 100;
    const lNorm = l / 100;

    const a = sNorm * Math.min(lNorm, 1 - lNorm);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        return lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };

    const r = Math.round(f(0) * 255);
    const g = Math.round(f(8) * 255);
    const b = Math.round(f(4) * 255);

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Calculates the perceived lightness of a color
 * @param r Red (0-255)
 * @param g Green (0-255)
 * @param b Blue (0-255)
 * @returns Perceived lightness value (0-1)
 */
export function getPerceivedLightness(r: number, g: number, b: number): number {
    return (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
}

/**
 * Calculate tag colors based on a base color
 * @param baseColor Hex color string (with or without #)
 * @returns Object with textColor, backgroundColor, and borderColor
 */
export function calculateGithubLabelColors(baseColor: string): {
    textColor: string;
    backgroundColor: string;
    borderColor: string;
} {
    const { r, g, b } = hexToRgb(baseColor);

    // Calculate perceived lightness using the same formula as in CSS
    const perceivedLightness = getPerceivedLightness(r, g, b);

    // Variables from CSS
    const lightnessThreshold = 0.6;
    const backgroundAlpha = 0.18;
    const borderAlpha = 0.3;

    // Calculate the lightness switch (equivalent to CSS: max(0, min(calc((1/(0.6 - perceivedLightness))), 1)))
    const lightnessSwitch =
        perceivedLightness >= lightnessThreshold
            ? 0
            : Math.max(0, Math.min(1 / (lightnessThreshold - perceivedLightness), 1));

    // Calculate the lightness adjustment (equivalent to CSS: ((0.6 - perceivedLightness) * 100) * lightnessSwitch)
    const lightenBy = (lightnessThreshold - perceivedLightness) * 100 * lightnessSwitch;

    // Get base HSL values from the color
    const { h, s, l: baseL } = rgbToHsl(r, g, b);

    // Default text lightness is based on the base color, but adjusted by lightenBy
    const textL = baseL + lightenBy;

    // Generate text color using HSL with the original hue/saturation but adjusted lightness
    const textColor = hslToRgb(h, s, textL);

    // Generate background color with alpha
    const backgroundColor = `rgba(${r}, ${g}, ${b}, ${backgroundAlpha})`;

    // Generate border color
    const borderColor = `rgba(${r}, ${g}, ${b}, ${borderAlpha})`;

    return {
        textColor,
        backgroundColor,
        borderColor,
    };
}
