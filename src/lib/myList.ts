import { useEffect, useState } from "react";

const KEY = "as_mylist";

function read(): number[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

/** Minha lista salva no aparelho. */
export function useMyList() {
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => setIds(read()), []);
  const toggle = (id: number) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
    localStorage.setItem(KEY, JSON.stringify(next));
    setIds(next);
  };
  return { ids, has: (id: number) => ids.includes(id), toggle };
}
