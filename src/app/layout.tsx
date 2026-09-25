import type { Metadata } from "next";
import { Fraunces, Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--font-sgi-display",
  subsets: ["latin"],
});

const sans = Source_Sans_3({
  variable: "--font-sgi-sans",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-sgi-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SGI Base",
  description:
    "Plataforma de Sistema de Gestión Integrada — ISO 9001, 14001 y 45001",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-sans)]">
        {children}
      </body>
    </html>
  );
}
