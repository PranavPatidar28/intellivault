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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "72px",
              height: "72px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #4FD1E0 0%, #1E8A99 100%)",
              fontSize: "44px",
            }}
          >
            🔒
          </div>
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
