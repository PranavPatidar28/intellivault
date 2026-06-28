/**
 * API route for server-side file uploads
 * POST /api/upload - Upload a file to Vercel Blob Storage
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { uploadFile } from "@/lib/upload/upload-service";
import { validateFile, getFileCategory, formatFileSize } from "@/lib/upload/file-types";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
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

        const limited = enforceRateLimit(session.user.id, RATE_LIMITS.upload);
        if (limited) return limited;

        // Parse form data
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const noteId = formData.get("noteId") as string | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "No file provided" },
                { status: 400 }
            );
        }

        // Validate file
        const validation = validateFile(file);
        if (!validation.isValid) {
            return NextResponse.json(
                { success: false, error: validation.error },
                { status: 400 }
            );
        }

        // Upload file
        const result = await uploadFile(file, session.user.id, noteId ?? undefined);

        return NextResponse.json({
            success: true,
            data: {
                id: result.id,
                url: result.url,
                filename: result.filename,
                mimeType: result.mimeType,
                fileType: result.fileType,
                size: result.size,
                sizeFormatted: formatFileSize(result.size),
                category: getFileCategory(result.mimeType),
            },
        });
    } catch (error) {
        console.error("[Upload API] Error:", error);

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
