import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { passkey } from "@better-auth/passkey";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

export const auth = betterAuth({
  appName: "rzp Store",
  baseURL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    requireEmailVerification: false,
    async sendResetPassword({ user, url }) {
      if (resend) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
          to: user.email,
          subject: "Reset your rzp Store password",
          html: `<p>Hi ${user.name},</p><p>Click <a href="${url}">here</a> to reset your password.</p>`,
        });
      } else {
        console.log(`[RESEND MOCK] Reset password link for ${user.email}: ${url}`);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      if (resend) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
          to: user.email,
          subject: "Verify your email address - rzp Store",
          html: `<p>Hi ${user.name},</p><p>Welcome to rzp Store! Click <a href="${url}">here</a> to verify your email address.</p>`,
        });
      } else {
        console.log(`[RESEND MOCK] Email verification link for ${user.email}: ${url}`);
      }
    },
  },
  plugins: [
    passkey({
      rpID: process.env.NODE_ENV === "production" ? "rzp-store.com" : "localhost",
      rpName: "rzp Store",
      origin: baseURL,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
