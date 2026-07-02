import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * Branded shell for the auth pages (sign in / sign up). Provides a full-screen
 * centered canvas with a soft indigo brand glow and the IntelliVault wordmark,
 * so each page only has to render its form card. Purely presentational — the
 * pages own all auth wiring.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-4">
      {/* Brand-tinted backdrop: a large blurred glow plus a faint dot grid. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 size-[44rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 size-[28rem] translate-x-1/4 translate-y-1/4 rounded-full bg-[var(--chart-4)]/10 blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--border)_1px,transparent_1px)] bg-[size:22px_22px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      <Link
        href="/"
        className="group mb-8 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <Logo
          iconSize={36}
          showText
          textClass="text-xl"
          className="transition-transform group-hover:scale-105 duration-200"
        />
      </Link>

      {children}
    </div>
  );
}
