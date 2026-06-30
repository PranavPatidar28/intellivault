import type { Metadata } from "next";
import { getServerSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "IntelliVault — Your second brain, intelligently organized",
  description:
    "The AI note vault that captures raw documents, PDFs and ideas, then structures, tags and connects them automatically — so you can find anything by meaning.",
  openGraph: {
    title: "IntelliVault — Your second brain, intelligently organized",
    description:
      "Capture anything. Find everything. AI-powered notes with smart tags, action items and semantic search.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "IntelliVault — Your second brain, intelligently organized",
    description:
      "Capture anything. Find everything. AI-powered notes with smart tags, action items and semantic search.",
  },
};

export default async function Home() {
  const session = await getServerSession();

  // Redirect authenticated users to dashboard
  if (session) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
