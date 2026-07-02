import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        {/* Simplified high-contrast logo for browser tab favicon */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer Shield Hexagon */}
          <path
            d="M50 8 L88 30 V70 L50 92 L12 70 V30 L50 8 Z"
            stroke="#4FD1E0"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="#080e11"
          />

          {/* Central Vault Safe Dial */}
          <circle
            cx="50"
            cy="50"
            r="16"
            fill="#0d1c22"
            stroke="#4FD1E0"
            strokeWidth="4"
          />
          <circle cx="50" cy="50" r="5" fill="#4FD1E0" />
          <path
            d="M50 50 L50 40"
            stroke="#4FD1E0"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Bold Neural connection paths */}
          <path
            d="M28 28 L40 40"
            stroke="#6366F1"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M72 28 L60 40"
            stroke="#6366F1"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M28 72 L40 60"
            stroke="#6366F1"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M72 72 L60 60"
            stroke="#6366F1"
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {/* Synapse dots */}
          <circle cx="28" cy="28" r="7" fill="#A855F7" />
          <circle cx="72" cy="28" r="7" fill="#A855F7" />
          <circle cx="28" cy="72" r="7" fill="#A855F7" />
          <circle cx="72" cy="72" r="7" fill="#A855F7" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
