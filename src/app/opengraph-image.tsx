import { ImageResponse } from "next/og";

// Static, on-brand social share image for IntelliVault. Next reuses this for
// both the OpenGraph unfurl and the Twitter card (summary_large_image), so a
// shared link gets a real preview instead of a blank/absent card.

export const alt =
  "IntelliVault — Your second brain, intelligently organized";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "radial-gradient(60% 60% at 50% 40%, #0d1f25 0%, #05070A 70%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          <svg
            width="72"
            height="72"
            viewBox="0 0 100 100"
            fill="none"
            style={{ display: "flex" }}
          >
            {/* Outer Hexagon Shield (Vault Structure) */}
            <path
              d="M50 6 L88 28 V72 L50 94 L12 72 V28 L50 6 Z"
              stroke="#4FD1E0"
              strokeWidth="5"
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="rgba(10, 18, 22, 0.4)"
            />

            {/* Inner Hexagon dashed ring */}
            <path
              d="M50 16 L79 33 V67 L50 84 L21 67 V33 L50 16 Z"
              stroke="#6366F1"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.5"
            />

            {/* Brain / Neural Network Nodes & Connections */}
            {/* Left Hemisphere Pathways */}
            <path
              d="M30 32 L24 48 L30 64 L42 72"
              stroke="#6366F1"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M30 32 L40 40 L50 50"
              stroke="#6366F1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />
            <path
              d="M30 64 L40 60 L50 50"
              stroke="#6366F1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />

            {/* Right Hemisphere Pathways */}
            <path
              d="M70 32 L76 48 L70 64 L58 72"
              stroke="#6366F1"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M70 32 L60 40 L50 50"
              stroke="#6366F1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />
            <path
              d="M70 64 L60 60 L50 50"
              stroke="#6366F1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />

            {/* Brain Synapse Nodes */}
            <circle cx="30" cy="32" r="3.5" fill="#A855F7" />
            <circle cx="24" cy="48" r="4.5" fill="#6366F1" />
            <circle cx="30" cy="64" r="3.5" fill="#A855F7" />
            <circle cx="42" cy="72" r="4" fill="#6366F1" />

            <circle cx="70" cy="32" r="3.5" fill="#A855F7" />
            <circle cx="76" cy="48" r="4.5" fill="#6366F1" />
            <circle cx="70" cy="64" r="3.5" fill="#A855F7" />
            <circle cx="58" cy="72" r="4" fill="#6366F1" />

            {/* Central Vault Dial (The Safe Core) */}
            <circle
              cx="50"
              cy="50"
              r="11"
              fill="#080e11"
              stroke="#4FD1E0"
              strokeWidth="2.5"
            />
            <circle cx="50" cy="50" r="4" fill="#4FD1E0" />
            <path
              d="M50 50 L50 43"
              stroke="#4FD1E0"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <div style={{ fontSize: "40px", fontWeight: 600, letterSpacing: "-0.02em" }}>
            IntelliVault
          </div>
        </div>

        <div
          style={{
            fontSize: "68px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            maxWidth: "900px",
          }}
        >
          Your second brain, intelligently organized
        </div>

        <div
          style={{
            marginTop: "32px",
            fontSize: "30px",
            color: "#9fb4ba",
            maxWidth: "880px",
            lineHeight: 1.35,
          }}
        >
          Capture anything. Find everything. AI-powered notes with smart tags,
          action items and semantic search.
        </div>
      </div>
    ),
    { ...size }
  );
}
