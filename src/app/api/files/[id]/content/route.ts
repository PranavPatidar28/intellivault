/**
 * Authenticated, owner-scoped file content proxy.
 *
 * GET /api/files/[id]/content streams an attachment's bytes only to its owner.
 * This is the canonical access path for private files: it verifies the session
 * owns the MediaAttachment before serving, and never exposes the underlying
 * storage URL to the client.
 *
 * IMPORTANT LIMITATION: the installed @vercel/blob only supports public blobs,
 * so the underlying *.blob.vercel-storage.com URL remains reachable by anyone
 * who already has it. This proxy is therefore defense-in-depth + the owner-
 * scoped path the app should reference — not a hard private-file guarantee. A
 * true guarantee requires a storage backend with private objects + signed URLs
 * (e.g. S3/R2). See README/security notes.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import prisma from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: await nextHeaders() });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Look up the attachment and enforce ownership before serving any bytes.
  const attachment = await prisma.mediaAttachment.findFirst({
    where: { id, userId: session.user.id },
    select: { url: true, mimeType: true, filename: true, fileType: true, size: true },
  });

  if (!attachment) {
    // 404 (not 403) so a non-owner can't distinguish "exists" from "not yours".
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    // Forward Range so video/audio seeking works.
    const range = request.headers.get("range");
    const upstream = await fetch(attachment.url, {
      headers: range ? { range } : undefined,
    });

    if (!upstream.ok && upstream.status !== 206) {
      console.error(
        `[Files content] upstream ${upstream.status} for attachment ${id}`
      );
      return NextResponse.json(
        { error: "Failed to load file" },
        { status: 502 }
      );
    }

    // Documents are forced to download (Content-Disposition: attachment) so a
    // crafted file can't be rendered inline in the app's origin context.
    const disposition =
      attachment.fileType === "DOCUMENT" ? "attachment" : "inline";
    const safeName = attachment.filename.replace(/["\\\r\n]/g, "_");

    const responseHeaders = new Headers();
    responseHeaders.set(
      "Content-Type",
      upstream.headers.get("content-type") || attachment.mimeType || "application/octet-stream"
    );
    responseHeaders.set(
      "Content-Disposition",
      `${disposition}; filename="${safeName}"`
    );
    // Owner-scoped content must never be cached by shared/proxy caches.
    responseHeaders.set("Cache-Control", "private, max-age=0, no-store");
    responseHeaders.set("X-Content-Type-Options", "nosniff");

    // Preserve range/length headers when present.
    for (const h of ["content-length", "content-range", "accept-ranges"]) {
      const v = upstream.headers.get(h);
      if (v) responseHeaders.set(h, v);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Files content] Error streaming attachment ${id}:`, error);
    return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
  }
}
