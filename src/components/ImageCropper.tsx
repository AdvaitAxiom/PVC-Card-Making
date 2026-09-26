"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Crop as CropIcon,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";
import { cx } from "@/lib/utils";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Handle = "nw" | "ne" | "sw" | "se" | "move";

/**
 * Trims and rotates a picture before it goes on the card.
 *
 * Everything is worked out on the natural pixels of the image, so the result
 * keeps its full resolution however small the preview happens to be.
 */
export default function ImageCropper({
  open,
  src,
  aspect,
  onCancel,
  onApply,
}: {
  open: boolean;
  src: string;
  /** Width ÷ height to lock the crop to, or undefined to crop freely. */
  aspect?: number;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    startBox: Box;
  } | null>(null);

  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState<Box | null>(null);
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [lockAspect, setLockAspect] = useState(aspect !== undefined);

  const ratio = aspect && aspect > 0 ? aspect : null;

  /** Starts with the biggest centred crop the picture allows. */
  const resetBox = useCallback(
    (w: number, h: number) => {
      if (!ratio || !lockAspect) {
        setBox({ x: 0, y: 0, w, h });
        return;
      }
      let cw = w;
      let ch = w / ratio;
      if (ch > h) {
        ch = h;
        cw = h * ratio;
      }
      setBox({ x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch });
    },
    [ratio, lockAspect],
  );

  /**
   * The dialog stays mounted while hidden, so its settings have to be set up
   * each time it opens — not just once when it is first created.
   */
  useEffect(() => {
    if (open) {
      setRotation(0);
      setLockAspect(aspect !== undefined);
      // A cached picture may not fire load again, so measure it directly.
      const img = imgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      }
    } else {
      setBox(null);
    }
  }, [open, aspect]);

  const onImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatural({ w, h });
    resetBox(w, h);
  }, [resetBox]);

  useEffect(() => {
    if (natural.w > 0) resetBox(natural.w, natural.h);
  }, [lockAspect, natural.w, natural.h, resetBox]);

  useEffect(() => {
    if (!dragging) return;

    function scale() {
      const img = imgRef.current;
      if (!img || natural.w === 0) return 1;
      return img.clientWidth / natural.w;
    }

    function handleMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || !box) return;
      const s = scale();
      const dx = (event.clientX - drag.startX) / s;
      const dy = (event.clientY - drag.startY) / s;
      const start = drag.startBox;
      const min = 24;
      const next: Box = { ...start };

      if (drag.handle === "move") {
        next.x = Math.min(Math.max(0, start.x + dx), natural.w - start.w);
        next.y = Math.min(Math.max(0, start.y + dy), natural.h - start.h);
      } else {
        const keep = ratio && lockAspect ? ratio : null;
        const right = drag.handle.includes("e");
        const bottom = drag.handle.includes("s");

        let w = right ? start.w + dx : start.w - dx;
        let h = bottom ? start.h + dy : start.h - dy;

        if (keep) {
          // Follow whichever edge moved further, so resizing feels natural.
          if (Math.abs(dx) > Math.abs(dy)) h = w / keep;
          else w = h * keep;
        }

        w = Math.max(min, w);
        h = Math.max(min, h);

        next.x = right ? start.x : start.x + (start.w - w);
        next.y = bottom ? start.y : start.y + (start.h - h);
        next.w = w;
        next.h = h;

        // Keep the crop inside the picture.
        if (next.x < 0) {
          next.w += next.x;
          next.x = 0;
          if (keep) next.h = next.w / keep;
        }
        if (next.y < 0) {
          next.h += next.y;
          next.y = 0;
          if (keep) next.w = next.h * keep;
        }
        if (next.x + next.w > natural.w) {
          next.w = natural.w - next.x;
          if (keep) next.h = next.w / keep;
        }
        if (next.y + next.h > natural.h) {
          next.h = natural.h - next.y;
          if (keep) next.w = next.h * keep;
        }
      }

      setBox(next);
    }

    function handleUp() {
      dragRef.current = null;
      setDragging(false);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragging, box, natural, ratio, lockAspect]);

  if (!open) return null;

  function startDrag(event: React.PointerEvent, handle: Handle) {
    if (!box) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startBox: { ...box },
    };
    setDragging(true);
  }

  function apply() {
    const img = imgRef.current;
    if (!img || !box) return;

    const canvas = document.createElement("canvas");
    const quarter = ((rotation % 360) + 360) % 360;
    const swap = quarter === 90 || quarter === 270;
    canvas.width = Math.round(swap ? box.h : box.w);
    canvas.height = Math.round(swap ? box.w : box.h);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((quarter * Math.PI) / 180);
    ctx.drawImage(
      img,
      box.x,
      box.y,
      box.w,
      box.h,
      -box.w / 2,
      -box.h / 2,
      box.w,
      box.h,
    );
    ctx.restore();

    onApply(canvas.toDataURL("image/png"));
  }

  const img = imgRef.current;
  const shownW = img?.clientWidth ?? 0;
  const s = natural.w > 0 && shownW > 0 ? shownW / natural.w : 0;

  const style = box && s
    ? {
        left: box.x * s,
        top: box.y * s,
        width: box.w * s,
        height: box.h * s,
      }
    : { display: "none" as const };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <CropIcon size={18} />
            Trim the picture
          </h2>
          <button onClick={onCancel} className="btn-ghost p-1.5" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-5">
          <div
            ref={frameRef}
            className="checker relative mx-auto w-fit select-none"
            style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="To trim"
              onLoad={onImageLoad}
              draggable={false}
              className="block max-h-[52vh] max-w-full object-contain"
            />

            {box ? (
              <>
                <div className="pointer-events-none absolute inset-0 bg-slate-900/45" />
                <div
                  className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.6)]"
                  style={style}
                  onPointerDown={(e) => startDrag(e, "move")}
                >
                  <div className="pointer-events-none absolute inset-0 bg-transparent" />
                  {(
                    [
                      { h: "nw" as const, cls: "-left-1.5 -top-1.5 cursor-nwse-resize" },
                      { h: "ne" as const, cls: "-right-1.5 -top-1.5 cursor-nesw-resize" },
                      { h: "sw" as const, cls: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
                      { h: "se" as const, cls: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
                    ]
                  ).map((handle) => (
                    <span
                      key={handle.h}
                      onPointerDown={(e) => startDrag(e, handle.h)}
                      className={cx(
                        "absolute h-3.5 w-3.5 rounded-full border-2 border-brand-600 bg-white",
                        handle.cls,
                      )}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-3">
          <button
            className="btn-secondary px-2.5 py-1.5 text-xs"
            onClick={() => setRotation((r) => r - 90)}
            title="Turn left"
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="btn-secondary px-2.5 py-1.5 text-xs"
            onClick={() => setRotation((r) => r + 90)}
            title="Turn right"
          >
            <RotateCw size={14} />
          </button>

          {ratio ? (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={lockAspect}
                onChange={(e) => setLockAspect(e.target.checked)}
              />
              Match the box shape
            </label>
          ) : null}

          <button
            className="btn-ghost px-2 py-1.5 text-xs"
            onClick={() => resetBox(natural.w, natural.h)}
          >
            Reset
          </button>

          {box ? (
            <span className="text-[11px] text-slate-400">
              {Math.round(box.w)} × {Math.round(box.h)} px
            </span>
          ) : null}

          <div className="ml-auto flex gap-2">
            <button className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn-primary" onClick={apply} disabled={!box}>
              <Check size={16} />
              Use this
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
