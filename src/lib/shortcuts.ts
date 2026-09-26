"use client";

/** True when the user is typing, so shortcuts must not steal the key. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable === true
  );
}

/** How far an arrow key moves something, in millimetres. */
export function nudgeStep(event: KeyboardEvent): number {
  if (event.shiftKey) return 1;
  if (event.altKey) return 0.05;
  return 0.2;
}

export function arrowDelta(key: string): { dx: number; dy: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { dx: -1, dy: 0 };
    case "ArrowRight":
      return { dx: 1, dy: 0 };
    case "ArrowUp":
      return { dx: 0, dy: -1 };
    case "ArrowDown":
      return { dx: 0, dy: 1 };
    default:
      return null;
  }
}
