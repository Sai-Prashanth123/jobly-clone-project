"use client";
import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

// The aurora gradients reference Tailwind palette colors as CSS vars
// (var(--blue-500), var(--white), …). The upstream snippet exposes those
// globally via an addVariablesForColors Tailwind plugin — but in this shadcn
// project that plugin would also emit `--background: hsl(var(--background))`
// (circular) and break theming. So we scope only the vars the aurora needs onto
// the component itself instead.
const AURORA_VARS: React.CSSProperties = {
  ["--white" as string]: "#ffffff",
  ["--black" as string]: "#000000",
  ["--transparent" as string]: "transparent",
  ["--blue-300" as string]: "#93c5fd",
  ["--blue-400" as string]: "#60a5fa",
  ["--blue-500" as string]: "#3b82f6",
  ["--indigo-300" as string]: "#a5b4fc",
  ["--violet-200" as string]: "#ddd6fe",
};

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  style,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div
      style={{ ...AURORA_VARS, ...style }}
      className={cn(
        "relative flex flex-col h-[100vh] items-center justify-center bg-zinc-50 dark:bg-zinc-900 text-slate-950 transition-bg",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          //   I'm sorry but this is what peak developer performance looks like // trigger warning
          className={cn(
            `
          [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)]
          [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)]
          [--aurora:repeating-linear-gradient(100deg,var(--blue-500)_10%,var(--indigo-300)_15%,var(--blue-300)_20%,var(--violet-200)_25%,var(--blue-400)_30%)]
          [background-image:var(--white-gradient),var(--aurora)]
          dark:[background-image:var(--dark-gradient),var(--aurora)]
          [background-size:300%,_200%]
          [background-position:50%_50%,50%_50%]
          filter blur-[10px] invert dark:invert-0
          after:content-[""] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)]
          after:dark:[background-image:var(--dark-gradient),var(--aurora)]
          after:[background-size:200%,_100%]
          after:animate-aurora after:[background-attachment:fixed] after:mix-blend-difference
          pointer-events-none
          absolute -inset-[10px] opacity-50 will-change-transform`,

            showRadialGradient &&
              `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]`
          )}
        ></div>
      </div>
      {children}
    </div>
  );
};
