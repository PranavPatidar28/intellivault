import Link from "next/link";
import { Logo } from "@/components/Logo";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { label: "Create account", href: "/signup" },
      { label: "Sign in", href: "/signin" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/10 px-5 py-14 sm:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 md:grid-cols-4">
        <div className="col-span-2 md:col-span-2">
          <Link href="/" className="group">
            <Logo
              iconSize={28}
              showText
              textClass="text-[15px] text-white transition-transform group-hover:scale-[1.02] duration-200"
              className="transition-transform group-hover:scale-[1.03] duration-200"
            />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/45">
            The AI note vault that captures, structures and connects your ideas
            so nothing gets lost.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="mb-4 text-sm font-semibold text-white/80">
              {col.heading}
            </h3>
            <ul className="space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-white/45 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6">
        <p className="text-sm text-white/35">
          © {new Date().getFullYear()} IntelliVault. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
