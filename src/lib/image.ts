"use client";

export async function readImageScaled(file: File, maxPx = 1400): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  if (file.type === "image/svg+xml") return dataUrl;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image could not be read."));
    img.src = dataUrl;
  });

  const scale = Math.min(1, maxPx / Math.max(image.width, image.height));
  if (scale >= 1 && dataUrl.length < 900_000) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const hasAlpha = file.type === "image/png" || file.type === "image/webp";
  return canvas.toDataURL(hasAlpha ? "image/png" : "image/jpeg", 0.92);
}
