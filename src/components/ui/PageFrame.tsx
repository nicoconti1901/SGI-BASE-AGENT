type PageFrameProps = {
  children: React.ReactNode;
  /** Content max width. Default matches page anatomy in the identity skill. */
  width?: "5xl" | "6xl" | "7xl";
  /** Ocupa el alto de la ventana: el contenido principal crece (home del hub). */
  fill?: boolean;
};

const WIDTH_CLASS = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  /** Hub: inicio y pantallas de cada módulo. */
  "7xl": "max-w-7xl",
} as const;

/** Centered content column for tenant/platform pages. */
export function PageFrame({ children, width = "5xl", fill = false }: PageFrameProps) {
  return (
    <div
      className={`mx-auto flex ${WIDTH_CLASS[width]} flex-col ${fill ? "w-full flex-1 gap-4" : "gap-8"}`}
      data-fill={fill ? "" : undefined}
    >{children}</div>
  );
}
