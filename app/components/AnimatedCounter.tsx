"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  end: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
};

export default function AnimatedCounter({
  end,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 2600,
}: Props) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || played.current) return;
        played.current = true;
        const start = performance.now();

        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = progress < 0.5\n            ? 4 * progress * progress * progress\n            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          setValue(end * eased);
          if (progress < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [end, duration]);

  const formatted =
    decimals > 0 ? value.toFixed(decimals) : Math.floor(value).toLocaleString("ko-KR");

  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
}
