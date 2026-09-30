type PageFrameProps = {
  children: React.ReactNode;
  /** Content max width. Default matches page anatomy in the identity skill. */
  width?: "5xl" | "6xl";
};

const WIDTH_CLASS = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
} as const;

/** Centered content column for tenant/platform pages. */
export function PageFrame({ children, width = "5xl" }: PageFrameProps) {
  return (
    <div className={`mx-auto flex ${WIDTH_CLASS[width]} flex-col gap-8`}>
      {children}
    </div>
  );
}
