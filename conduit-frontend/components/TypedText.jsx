"use client";

import { useTypewriter } from "../hooks/useTypewriter";

export default function TypedText({ text, className }) {
  const shown = useTypewriter(text);
  return <span className={className}>{shown}</span>;
}
