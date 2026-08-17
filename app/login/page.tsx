import { Suspense } from "react";
import { AuthForm } from "@/src/components/auth/auth-form";

export default function LoginPage() {
  return <Suspense><AuthForm mode="login" /></Suspense>;
}

