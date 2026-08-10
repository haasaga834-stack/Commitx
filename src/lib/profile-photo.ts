/**
 * Client-side profile photo handling: reads a picked file, downscales it to a
 * small square JPEG data URL so it can live on the user's profile row.
 */
const MAX_SIZE = 256;

export async function fileToProfilePhoto(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not open that image."));
    el.src = dataUrl;
  });

  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = MAX_SIZE;
  canvas.height = MAX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  // Center-crop to a square, then scale down.
  ctx.drawImage(
    img,
    (img.width - side) / 2,
    (img.height - side) / 2,
    side,
    side,
    0,
    0,
    MAX_SIZE,
    MAX_SIZE,
  );

  return canvas.toDataURL("image/jpeg", 0.82);
}
