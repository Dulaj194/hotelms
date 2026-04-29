import { useCallback, useRef } from "react";
import type { PointerEventHandler } from "react";

type SwipeNavigationHandlers<T extends HTMLElement> = {
  onPointerDown: PointerEventHandler<T>;
  onPointerMove: PointerEventHandler<T>;
  onPointerUp: PointerEventHandler<T>;
  onPointerCancel: PointerEventHandler<T>;
};

type UseSwipeNavigationOptions = {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
  verticalTolerance?: number;
};

type SwipeStart = {
  pointerId: number;
  x: number;
  y: number;
};

export function useSwipeNavigation<T extends HTMLElement>({
  onSwipeLeft,
  onSwipeRight,
  threshold = 56,
  verticalTolerance = 76,
}: UseSwipeNavigationOptions): SwipeNavigationHandlers<T> {
  const startRef = useRef<SwipeStart | null>(null);
  const latestRef = useRef({ x: 0, y: 0 });

  const reset = useCallback(() => {
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback<PointerEventHandler<T>>((event) => {
    if (event.pointerType === "mouse") return;

    startRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    latestRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onPointerMove = useCallback<PointerEventHandler<T>>((event) => {
    if (!startRef.current || startRef.current.pointerId !== event.pointerId) return;
    latestRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onPointerUp = useCallback<PointerEventHandler<T>>(
    (event) => {
      const start = startRef.current;
      if (!start || start.pointerId !== event.pointerId) return;

      const deltaX = latestRef.current.x - start.x;
      const deltaY = latestRef.current.y - start.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      reset();

      if (absX < threshold || absY > verticalTolerance || absY > absX * 0.8) {
        return;
      }

      if (deltaX > 0) {
        onSwipeRight();
        return;
      }

      onSwipeLeft();
    },
    [onSwipeLeft, onSwipeRight, reset, threshold, verticalTolerance]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: reset,
  };
}
