"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eraser, PenLine, Upload, X } from "lucide-react";
import { readImageScaled } from "@/lib/image";

/**
 * Lets the user sign with a mouse, finger or stylus, and hands back a
 * transparent PNG so the signature sits cleanly on the card artwork.
 */
export default function SignaturePad({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [penWidth, setPenWidth] = useState(3);
  const [penColour, setPenColour] = useState("#0b1f44");
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    setHasInk(false);
  }, [open]);

  if (!open) return null;

  function position(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = position(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = position(event);
    ctx.strokeStyle = penColour;
    ctx.lineWidth = penWidth * 2;
    ctx.lineTo(x, y);
    ctx.stroke();
    dirty.current = true;
    if (!hasInk) setHasInk(true);
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    setHasInk(false);
  }

  /** Crops away the empty space so the signature fills its box on the card. */
  function save() {
    const canvas = canvasRef.current;
    if (!canvas || !dirty.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return;

    const pad = 8;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);

    const out = document.createElement("canvas");
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out
      .getContext("2d")!
      .drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);

    onSave(out.toDataURL("image/png"));
    onClose();
  }

  async function uploadInstead(file: File | undefined) {
    if (!file) return;
    const dataUrl = await readImageScaled(file, 1200);
    onSave(dataUrl);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <PenLine size={18} />
            Sign here
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <p className="mb-2 text-xs text-slate-500">
            Draw with your mouse, finger or a stylus. The empty space around your signature
            is trimmed off automatically.
          </p>
          <canvas
            ref={canvasRef}
            width={900}
            height={300}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            className="checker h-[200px] w-full cursor-crosshair touch-none rounded-lg border-2 border-dashed border-slate-300"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              Pen
              <input
                type="range"
                min={1}
                max={8}
                value={penWidth}
                onChange={(e) => setPenWidth(Number(e.target.value))}
                className="w-20 accent-brand-600"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              Colour
              <input
                type="color"
                value={penColour}
                onChange={(e) => setPenColour(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
              />
            </label>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={clear}>
              <Eraser size={14} />
              Clear
            </button>
            <label className="btn-ghost cursor-pointer px-2 py-1 text-xs">
              <Upload size={14} />
              Upload instead
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => uploadInstead(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={!hasInk}>
            <Check size={16} />
            Use this signature
          </button>
        </div>
      </div>
    </div>
  );
}
