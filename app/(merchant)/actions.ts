"use server";

import { redirect } from "next/navigation";
import { clearMerchantAuthCookie } from "@/lib/auth/merchant";

export async function logoutAction() {
  await clearMerchantAuthCookie();
  redirect("/login");
}
