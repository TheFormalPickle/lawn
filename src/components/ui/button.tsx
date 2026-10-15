import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] border border-transparent",
        primary:
          "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] border border-transparent",
        destructive:
          "bg-[var(--destructive)] text-[var(--foreground-inverse)] border border-transparent hover:opacity-90",
        outline:
          "border border-[var(--border)] bg-transparent text-foreground hover:bg-[var(--surface-alt)]",
        secondary:
          "bg-[var(--surface-alt)] text-foreground hover:bg-[var(--surface-muted)] border border-transparent",
        ghost:
          "text-foreground hover:bg-[var(--surface-alt)] border border-transparent",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
