import { cn } from "@/lib/utils";

export const BRAND_LOGO_SRC = "/brand/logo-salis.png";
export const BRAND_MARK_SRC = "/brand/logo-mark.png";

const SIZE = {
  full: {
    sm: "h-10 max-w-[9.5rem]",
    md: "h-[3.75rem] max-w-[12rem]",
    lg: "h-[4.6rem] max-w-[13rem]",
    xl: "h-[8.5rem] max-w-[18rem]",
  },
  mark: {
    sm: "size-8",
    md: "size-10",
    lg: "size-12",
    xl: "size-16",
  },
} as const;

export function BrandLogo({
  tone = "light",
  size = "md",
  align = "left",
  variant = "full",
  className,
}: {
  tone?: "light" | "dark";
  size?: keyof typeof SIZE.full;
  align?: "left" | "center";
  variant?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <img
      src={variant === "mark" ? BRAND_MARK_SRC : BRAND_LOGO_SRC}
      alt="Salis 3 Hottes — Nettoyage-Dégraissage"
      draggable={false}
      className={cn(
        "brand-logo w-auto object-contain select-none",
        SIZE[variant][size],
        align === "center" ? "mx-auto" : "object-left",
        tone === "dark" && "brand-logo-on-dark brightness-0 invert",
        className,
      )}
    />
  );
}
