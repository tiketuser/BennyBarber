/**
 * Shrinks a photo before upload: longest side at most `max` px, re-encoded as JPEG.
 * Phone photos are 3-8 MB; the gallery shows them at most ~600px wide, so ~150 KB is plenty.
 */
export async function shrinkImage(file: Blob, max = 1280, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('לא הצלחנו לקרוא את התמונה');
  });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('לא הצלחנו לעבד את התמונה'))), 'image/jpeg', quality));
}
