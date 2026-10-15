import type { ComponentProps } from "react";
import type { SignIn } from "@clerk/tanstack-react-start";

export const authAppearance = {
  variables: {
    fontFamily: "'Geist', system-ui, sans-serif",
    colorPrimary: "var(--accent)",
    colorBackground: "var(--surface)",
    colorText: "var(--foreground)",
    colorTextSecondary: "var(--foreground-muted)",
    colorInputBackground: "var(--background)",
    colorInputText: "var(--foreground)",
    colorTextOnPrimaryBackground: "var(--accent-foreground)",
    borderRadius: "0.75rem",
  },
  elements: {
    card: "border border-line rounded-2xl shadow-none",
    headerTitle: "font-sans font-semibold tracking-tight",
    headerSubtitle: "font-sans text-muted",
    formButtonPrimary: "font-sans font-medium shadow-none rounded-xl",
    socialButtonsBlockButton: "border border-line rounded-xl shadow-none",
    formFieldInput: "border border-line rounded-xl shadow-none",
    formFieldLabel: "font-sans font-medium",
    footer: "hidden",
  },
} satisfies NonNullable<ComponentProps<typeof SignIn>["appearance"]>;
