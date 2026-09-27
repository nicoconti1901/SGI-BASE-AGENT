"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { devPasswordFor, isDevQuickAccessEnabled } from "@/lib/dev-access";

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

/** Login de un clic desde el home. Solo existe en `next dev`. */
export async function devQuickSignInAction(email: string) {
  if (!isDevQuickAccessEnabled()) {
    throw new Error("Acceso rápido deshabilitado");
  }

  try {
    await auth.api.signInEmail({
      body: { email, password: devPasswordFor(email) },
      headers: await headers(),
    });
  } catch {
    // La cuenta existe pero con otra contraseña: formulario con el email ya cargado.
    redirect(`/login?email=${encodeURIComponent(email)}&aviso=clave`);
  }

  redirect("/portal");
}
