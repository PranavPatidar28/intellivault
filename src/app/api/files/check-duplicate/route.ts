/**
 * API route for checking duplicate files
 * POST /api/files/check-duplicate - Check if file already exists by hash
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { formatFileSize } from "@/lib/upload/file-types";

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { filename, size, mimeType } = body;

        if (!filename || !size) {
            return NextResponse.json(
                { success: false, error: "Filename and size are required" },
                { status: 400 }
            );
        }

        // Check for existing file with same name, size, and mime type
        // This is a simple heuristic - for truly accurate duplicate detection,
        // you'd compute and store file hashes
        const existingFile = await prisma.mediaAttachment.findFirst({
            where: {
                userId: session.user.id,
                filename: filename,
                size: size,
                ...(mimeType ? { mimeType: mimeType } : {}),
            },
            select: {
                id: true,
                url: true,
                filename: true,
                mimeType: true,
                size: true,
                fileType: true,
                createdAt: true,
            },
        });

        if (existingFile) {
            return NextResponse.json({
                success: true,
                isDuplicate: true,
                existingFile: {
                    ...existingFile,
                    sizeFormatted: formatFileSize(existingFile.size),
                },
            });
        }

        return NextResponse.json({
            success: true,
            isDuplicate: false,
        });
    } catch (error) {
        console.error("[Files API] Error checking duplicate:", error);
        return NextResponse.json(
            { success: false, error: "Failed to check for duplicates" },
            { status: 500 }
        );
    }
}
