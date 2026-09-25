import { createAuthClient } from "better-auth/react";

/**
 * Sin baseURL hardcodeado: usa el origen actual del browser.
 * Evita Failed to fetch cuando Next corre en 3001 (u otro puerto)
 * mientras .env sigue apuntando a 3000.
 */
export const authClient = createAuthClient();
