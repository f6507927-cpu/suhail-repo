import { Slot, Slottable } from "@radix-ui/react-slot";
import { CircleAlert } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes } from "react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const variants = {
  default: "bg-primary text-primary-foreground hover:underline",
  destructive: "bg-destructive text-destructive-foreground hover:underline",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-secondary",
  secondary: "bg-secondary text-secondary-foreground hover:underline",
  ghost: "text-foreground hover:bg-secondary",
  link: "text-primary underline-offset-4 hover:underline",
} as const;

const sizes = {
  default: "min-h-10 px-4 py-2",
  sm: "min-h-9 px-3 text-sm",
  lg: "min-h-11 px-6",
  icon: "size-10",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export function Button({
  asChild = false,
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {variant === "destructive" && (
        <CircleAlert aria-hidden="true" size={16} strokeWidth={1.6} />
      )}
      {asChild ? <Slottable>{children}</Slottable> : children}
    </Component>
  );
}
