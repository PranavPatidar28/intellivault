import "./reactbits/reactbits.css";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { FeatureBento } from "./FeatureBento";
import { HowItWorks } from "./HowItWorks";
import { FinalCTA } from "./FinalCTA";
import { Footer } from "./Footer";

// Server component. The `dark` class forces the dark palette locally regardless
// of the user's global next-themes setting; the espresso-ink/brass background is
// anchored to the brand ramp so it renders identically in any theme.
export function LandingPage() {
  return (
    <div className="dark relative min-h-screen overflow-x-hidden bg-[#06080B] text-white antialiased selection:bg-[#4FD1E0]/30 selection:text-white">
      {/* ambient base glows behind everything */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, rgba(13,26,31,0.55) 0%, rgba(6,8,11,0) 55%), radial-gradient(80% 60% at 100% 100%, rgba(79,209,224,0.12), transparent 60%)",
        }}
      />
      {/* Film grain — a faint static noise overlay that kills the flat
          "digital gradient" look and lends the dark theme a filmic depth. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: "160px 160px",
        }}
      />
      <Nav />
      <main>
        <Hero />
        <FeatureBento />
        <HowItWorks />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
