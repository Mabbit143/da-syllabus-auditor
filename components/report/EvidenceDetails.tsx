"use client";
import { useEffect, useRef, type ReactNode } from "react";

export default function EvidenceDetails({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    let previous = false;
    const before = () => {
      if (!ref.current) return;
      previous = ref.current.open;
      ref.current.open = true;
    };
    const after = () => {
      if (ref.current) ref.current.open = previous;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return (
    <details ref={ref} id={id} className="evidence-details">
      <summary>{label}</summary>
      <div className="evidence-details__body">{children}</div>
    </details>
  );
}
