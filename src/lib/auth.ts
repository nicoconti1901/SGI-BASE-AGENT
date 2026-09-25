import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
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
});

export type Session = typeof auth.$Infer.Session;
