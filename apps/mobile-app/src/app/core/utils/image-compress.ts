/**
 * Client-side image compression for profile photos.
 *
 * Resizes the image to a maximum dimension (default 256px) and compresses
 * to JPEG at the given quality. This keeps profile photos lightweight
 * (~10–30 KB) regardless of the source image size.
 */

/** Options for compressing a profile photo. */
export interface CompressOptions {
  /** Maximum width or height in pixels. Default 256. */
  maxSize?: number;
  /** JPEG quality from 0 to 1. Default 0.7. */
  quality?: number;
}

/**
 * Compress an image from a data URI (base64) or a Blob URL to a JPEG Blob.
 *
 * Uses an off-screen canvas to resize + re-encode. Works in both web and
 * Capacitor WebView contexts.
 */
export function compressProfilePhoto(
  src: string,
  opts: CompressOptions = {},
): Promise<Blob> {
  const maxSize = opts.maxSize ?? 256;
  const quality = opts.quality ?? 0.7;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate scaled dimensions maintaining aspect ratio
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) {
          height = Math.round(height * (maxSize / width));
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round(width * (maxSize / height));
          height = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob returned null'));
          }
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));

    // Handle both data URIs and blob URLs
    img.src = src;
  });
}
