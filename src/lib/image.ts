// Client-side image utilities. Images taken during study are stored as JPEG
// data URLs on the QuestionRow.image_url column so they ride the same offline
// sync path as everything else. Long-term this should move to Supabase Storage,
// but for now — with local-first + small photo counts — DataURLs are enough.

const MAX_EDGE = 1400;
const JPEG_QUALITY = 0.82;
const MAX_BYTES = 6 * 1024 * 1024; // ~6 MB post-compression cap

export interface CompressedImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export class ImageTooLargeError extends Error {
  constructor(bytes: number) {
    super(`Compressed image is ${(bytes / 1024 / 1024).toFixed(1)} MB — over 6 MB limit.`);
    this.name = 'ImageTooLargeError';
  }
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image.'));
    img.src = dataUrl;
  });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error('Read failed.'));
    fr.readAsDataURL(file);
  });
}

/**
 * Downscale a picked File to a JPEG data URL, cap at 1400px on the long edge.
 * Bytes are estimated from the base64 payload length (± few percent, close
 * enough for a client-side sanity cap).
 */
export async function compressToDataUrl(file: File): Promise<CompressedImage> {
  const raw = await readAsDataURL(file);
  const img = await loadImage(raw);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable.');
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > MAX_BYTES) throw new ImageTooLargeError(bytes);
  return { dataUrl, width: w, height: h, bytes };
}
