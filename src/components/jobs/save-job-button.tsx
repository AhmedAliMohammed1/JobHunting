"use client";

import { useState } from "react";
import { Bookmark, Check } from "lucide-react";

export function SaveJobButton({ title }: { title: string }) {
  const [saved, setSaved] = useState(false);
  return <button className="save-button" aria-label={saved ? `${title} saved` : `Save ${title}`} aria-pressed={saved} onClick={() => setSaved((value) => !value)}>{saved ? <Check size={17} /> : <Bookmark size={17} />}</button>;
}
