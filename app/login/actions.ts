"use server";

import { redirect } from "next/navigation";
import { checkMerchantPassword, setMerchantAuthCookie } from "@/lib/auth/merchant";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");

  if (!checkMerchantPassword(password)) {
    return { error: "Incorrect password." };
  }

  await setMerchantAuthCookie();
  redirect("/dashboard");
}
