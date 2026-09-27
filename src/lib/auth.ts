import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

const appUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;

export const auth = betterAuth({
  baseURL: appUrl,
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    ...(appUrl ? [appUrl] : []),
  ],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      platformRole: {
        type: "string",
        required: false,
        defaultValue: null,
        input: false,
      },
    },
  },
  session: {
    additionalFields: {
      activeTenantId: {
        type: "string",
        required: false,
        defaultValue: null,
        input: false,
      },
    },
  },
  // Debe ir último: permite que las server actions (acceso rápido dev) fijen la cookie.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
