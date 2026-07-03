import { useEffect, useState } from "react";

// Reveals `text` progressively, character by character, instead of dumping
// the whole brief on screen the instant the API response lands. Resets and
// restarts whenever `text` changes (e.g. a new brief loads).
export function useTypewriter(text, { speed = 18 } = {}) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (!text) {
      setShown("");
      return;
    }
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return shown;
}
