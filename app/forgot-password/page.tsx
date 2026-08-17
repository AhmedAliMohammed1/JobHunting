import { Suspense } from "react";
import { AuthForm } from "@/src/components/auth/auth-form";

export default function ForgotPasswordPage() {
  return <Suspense><AuthForm mode="forgot" /></Suspense>;
}

