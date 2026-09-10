export const MAX_DIMENSION = 800;
export const MIN_DIMENSION = 200;
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const JPEG_QUALITY = 0.7;

export interface ScreenshotCheck {
  valid: boolean;
  reason?: string;
}

export function checkDimensions(width: number, height: number): ScreenshotCheck {
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return { valid: false, reason: "Image too small" };
  }
  if (width > 4000 || height > 4000) {
    return { valid: false, reason: "Image too large" };
  }
  return { valid: true };
}

export function checkFileSize(bytes: number): ScreenshotCheck {
  if (bytes <= 0) {
    return { valid: false, reason: "Empty file" };
  }
  if (bytes > MAX_FILE_SIZE_BYTES) {
    return { valid: false, reason: "File too large" };
  }
  return { valid: true };
}

export function calculateResizeDimensions(
  width: number,
  height: number,
  maxDim: number = MAX_DIMENSION,
): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) {
    return { width, height };
  }
  const ratio = Math.min(maxDim / width, maxDim / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

export function isLikelyBlank(pixels: Uint8ClampedArray, threshold: number = 0.95): boolean {
  let total = 0;
  let nearWhite = 0;
  let nearBlack = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    total++;
    if (r > 240 && g > 240 && b > 240) nearWhite++;
    if (r < 15 && g < 15 && b < 15) nearBlack++;
  }
  const whiteRatio = nearWhite / total;
  const blackRatio = nearBlack / total;
  return whiteRatio > threshold || blackRatio > threshold;
}
