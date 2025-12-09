/**
 * API route for client-side uploads with Vercel Blob
 * POST /api/upload/client-token - Generate a client token for direct browser uploads
 * 
 * This enables progress tracking and larger file uploads directly from the browser
 */

import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import {
    validateFile,
    getFileCategory,
    generateBlobPathname,
    FILE_TYPE_CONFIG,
    type FileCategory,
} from "@/lib/upload/file-types";
import { FileType } from "@/generated/prisma/client";

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

    const userId = session.user.id;
    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname, clientPayload) => {
                // Parse the client payload for additional context
                const payload = clientPayload ? JSON.parse(clientPayload) : {};
                const { noteId, filename, mimeType, size } = payload;

                // Validate file type and size
                if (mimeType) {
                    const category = getFileCategory(mimeType);
                    const maxSize = FILE_TYPE_CONFIG[category].maxSize;

                    if (size && size > maxSize) {
                        throw new Error(
                            `File size exceeds maximum allowed for ${category.toLowerCase()} files`
                        );
                    }
                }

                // Generate a unique pathname
                const blobPathname = generateBlobPathname(
                    filename || pathname,
                    userId
                );

                return {
                    allowedContentTypes: [
                        ...FILE_TYPE_CONFIG.IMAGE.mimeTypes,
                        ...FILE_TYPE_CONFIG.VIDEO.mimeTypes,
                        ...FILE_TYPE_CONFIG.AUDIO.mimeTypes,
                        ...FILE_TYPE_CONFIG.DOCUMENT.mimeTypes,
                    ],
                    tokenPayload: JSON.stringify({
                        userId,
                        noteId,
                        filename,
                        mimeType,
                        size,
                    }),
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                // Parse the token payload
                const payload = tokenPayload ? JSON.parse(tokenPayload) : {};
                const { userId, noteId, filename, mimeType, size } = payload;

                if (!userId || !mimeType) {
                    console.error("[Client Upload] Missing required payload data");
                    return;
                }

                try {
                    const category = getFileCategory(mimeType);

                    // Create database record
                    await prisma.mediaAttachment.create({
                        data: {
                            url: blob.url,
                            pathname: blob.pathname,
                            filename: filename || blob.pathname.split("/").pop() || "unknown",
                            mimeType,
                            fileType: categoryToFileType(category),
                            size: size || 0,
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

        const message = error instanceof Error ? error.message : "Upload failed";

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
