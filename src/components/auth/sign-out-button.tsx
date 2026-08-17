"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    const response = await fetch("/api/account/logout", { method: "POST" });
    if (response.ok) {
      router.replace("/login");
      router.refresh();
    } else setPending(false);
  }
  return <button className="text-button" type="button" onClick={signOut} disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button>;
}
