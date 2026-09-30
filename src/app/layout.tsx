import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Sans, Sora } from "next/font/google";
import "./globals.css";

// Light A: Instrument Sans (display) · Dark A: Sora (display). Sans/mono comparten Geist.
const displayLight = Instrument_Sans({
  variable: "--font-sgi-display-light",
  subsets: ["latin"],
});

const displayDark = Sora({
  variable: "--font-sgi-display-dark",
  subsets: ["latin"],
});

const sans = Geist({
  variable: "--font-sgi-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-sgi-mono",
  subsets: ["latin"],
});

/** Aplica el tema antes del primer render (evita parpadeo). Sin preferencia guardada, sigue al sistema. */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("sgi-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})();`;

export const metadata: Metadata = {
  title: "SGI Base",
  description:
    "Plataforma de Sistema de Gestión Integrada — ISO 9001, 14001 y 45001",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${displayLight.variable} ${displayDark.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-sans)]">
        {children}
      </body>
    </html>
  );
}
