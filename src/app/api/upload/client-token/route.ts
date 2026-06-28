/**
 * API route for client-side uploads with Vercel Blob
 * POST /api/upload/client-token - Generate a client token for direct browser uploads
 * 
 * This enables progress tracking and larger file uploads directly from the browser
 */

import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { head } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import {
    getFileCategory,
    isSupportedMimeType,
    generateBlobPathname,
    FILE_TYPE_CONFIG,
    type FileCategory,
} from "@/lib/upload/file-types";
import { FileType } from "@/generated/prisma/client";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Convert FileCategory to Prisma FileType enum
 */
function categoryToFileType(category: FileCategory): FileType {
    switch (category) {
        case "IMAGE":
            return FileType.IMAGE;
        case "VIDEO":
            return FileType.VIDEO;
        case "AUDIO":
            return FileType.AUDIO;
        case "DOCUMENT":
            return FileType.DOCUMENT;
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    // Authenticate user
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    const limited = enforceRateLimit(session.user.id, RATE_LIMITS.upload);
    if (limited) return limited;

    const userId = session.user.id;
    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname, clientPayload) => {
                // Parse the client payload for additional context
                const payload = clientPayload ? JSON.parse(clientPayload) : {};
                const { noteId, filename, mimeType } = payload;

                // Require a supported MIME type up front. Skipping validation
                // when mimeType is absent would let a caller bypass the size cap
                // entirely, so reject instead.
                if (!mimeType || !isSupportedMimeType(mimeType)) {
                    throw new Error("Unsupported or missing file type");
                }

                const category = getFileCategory(mimeType);
                const maxSize = FILE_TYPE_CONFIG[category].maxSize;

                // Generate a unique pathname
                const blobPathname = generateBlobPathname(
                    filename || pathname,
                    userId
                );

                return {
                    allowedContentTypes: FILE_TYPE_CONFIG[category].mimeTypes,
                    // Vercel Blob enforces this server-side regardless of any
                    // client-claimed size, so an attacker cannot upload a larger
                    // file by lying in clientPayload.
                    maximumSizeInBytes: maxSize,
                    tokenPayload: JSON.stringify({
                        userId,
                        noteId,
                        filename,
                        mimeType,
                        pathname: blobPathname,
                    }),
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                // Parse the token payload
                const payload = tokenPayload ? JSON.parse(tokenPayload) : {};
                const { userId, noteId, filename, mimeType } = payload;

                if (!userId || !mimeType) {
                    console.error("[Client Upload] Missing required payload data");
                    return;
                }

                try {
                    const category = getFileCategory(mimeType);

                    // Derive the authoritative size from blob metadata rather
                    // than trusting the client-supplied value.
                    let size = 0;
                    try {
                        const meta = await head(blob.url);
                        size = meta.size;
                    } catch (headError) {
                        console.error("[Client Upload] Failed to read blob metadata:", headError);
                    }

                    // Create database record
                    await prisma.mediaAttachment.create({
                        data: {
                            url: blob.url,
                            pathname: blob.pathname,
                            filename: filename || blob.pathname.split("/").pop() || "unknown",
                            mimeType,
                            fileType: categoryToFileType(category),
                            size,
                            userId,
                            noteId: noteId || null,
                        },
                    });
                } catch (error) {
                    console.error("[Client Upload] Failed to create attachment record:", error);
                    throw new Error("Failed to complete upload");
                }
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        console.error("[Client Upload API] Error:", error);

        const message =
            process.env.NODE_ENV !== "production" && error instanceof Error
                ? error.message
                : "Upload failed";

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
