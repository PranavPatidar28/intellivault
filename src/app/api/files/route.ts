/**
 * API route for file management (list/delete)
 * GET /api/files - List user's uploaded files
 * DELETE /api/files - Delete a file by URL
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { deleteFile, getUserAttachments } from "@/lib/upload/upload-service";
import { formatFileSize } from "@/lib/upload/file-types";
import { FileType } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
    try {
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

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const noteId = searchParams.get("noteId") ?? undefined;
        const fileTypeParam = searchParams.get("fileType");
        const limit = parseInt(searchParams.get("limit") ?? "50", 10);
        const offset = parseInt(searchParams.get("offset") ?? "0", 10);

        // Convert fileType string to enum if provided
        let fileType: FileType | undefined;
        if (fileTypeParam && Object.values(FileType).includes(fileTypeParam as FileType)) {
            fileType = fileTypeParam as FileType;
        }

        const attachments = await getUserAttachments(session.user.id, {
            noteId,
            fileType,
            limit: Math.min(limit, 100), // Cap at 100
            offset,
        });

        return NextResponse.json({
            success: true,
            data: attachments.map((a) => ({
                ...a,
                sizeFormatted: formatFileSize(a.size),
            })),
        });
    } catch (error) {
        console.error("[Files API] Error listing files:", error);

        return NextResponse.json(
            { success: false, error: "Failed to list files" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
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

        // Get URL from request body
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== "string") {
            return NextResponse.json(
                { success: false, error: "File URL is required" },
                { status: 400 }
            );
        }

        await deleteFile(url, session.user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Files API] Error deleting file:", error);

        const message = error instanceof Error ? error.message : "Failed to delete file";

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
