/** Verkleinert Fotos vor dem Speichern (max. 2000 px, JPEG) – Handyfotos haben sonst schnell 8 MB. */
export async function bildVerkleinern(datei: File, max = 2000): Promise<Blob> {
  if (!datei.type.startsWith('image/') || datei.type === 'image/gif') return datei;
  const bmp = await createImageBitmap(datei).catch(() => null);
  if (!bmp) return datei;
  const f = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (f === 1 && datei.size < 1_500_000) return datei;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * f);
  canvas.height = Math.round(bmp.height * f);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b ?? datei), 'image/jpeg', 0.86));
}

/** Nächster freier Name „bild-n.<ext>“ passend zum Bildtyp. */
export function freierBildname(vorhanden: string[], blob: Blob): string {
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  let n = 1;
  while (vorhanden.some((name) => name.startsWith(`bild-${n}.`))) n++;
  return `bild-${n}.${ext}`;
}
