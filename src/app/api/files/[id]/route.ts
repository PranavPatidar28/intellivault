/**
 * API route for individual file operations
 * PATCH /api/files/[id] - Rename a file
 * GET /api/files/[id] - Get file details with note usage
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { formatFileSize } from "@/lib/upload/file-types";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

        const { id } = await params;

        const attachment = await prisma.mediaAttachment.findUnique({
            where: { id },
            include: {
                note: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        });

        if (!attachment) {
            return NextResponse.json(
                { success: false, error: "File not found" },
                { status: 404 }
            );
        }

        if (attachment.userId !== session.user.id) {
            return NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 403 }
            );
        }

        // Find all notes that reference this file URL in their JSON content
        // We need to search the stringified JSON since Prisma doesn't support deep JSON search
        const allUserNotes = await prisma.note.findMany({
            where: {
                userId: session.user.id,
            },
            select: {
                id: true,
                title: true,
                contentJSON: true,
            },
        });

        // Filter notes that contain the URL in their JSON structure
        const notesUsingFile = allUserNotes.filter(note => {
            const jsonStr = JSON.stringify(note.contentJSON);
            return jsonStr.includes(attachment.url);
        }).map(note => ({ id: note.id, title: note.title }));

        return NextResponse.json({
            success: true,
            data: {
                ...attachment,
                sizeFormatted: formatFileSize(attachment.size),
                usedInNotes: notesUsingFile,
            },
        });
    } catch (error) {
        console.error("[Files API] Error getting file:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get file" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

        const { id } = await params;
        const body = await request.json();
        const { filename } = body;

        if (!filename || typeof filename !== "string" || filename.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: "Filename is required" },
                { status: 400 }
            );
        }

        // Find the attachment and verify ownership
        const attachment = await prisma.mediaAttachment.findUnique({
            where: { id },
        });

        if (!attachment) {
            return NextResponse.json(
                { success: false, error: "File not found" },
                { status: 404 }
            );
        }

        if (attachment.userId !== session.user.id) {
            return NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 403 }
            );
        }

        // Update the filename
        const updated = await prisma.mediaAttachment.update({
            where: { id },
            data: { filename: filename.trim() },
        });

        return NextResponse.json({
            success: true,
            data: {
                ...updated,
                sizeFormatted: formatFileSize(updated.size),
            },
        });
    } catch (error) {
        console.error("[Files API] Error renaming file:", error);
        return NextResponse.json(
            { success: false, error: "Failed to rename file" },
            { status: 500 }
        );
    }
}
