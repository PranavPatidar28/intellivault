import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

/**
 * POST /api/user/export
 * Export all user data as JSON
 */
export async function POST() {
    try {
        const session = await requireAuth();
        const userId = session.user.id;

        // Fetch all user data
        const [user, notes, tags, preferences] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    createdAt: true,
                },
            }),
            prisma.note.findMany({
                where: { userId },
                include: {
                    tags: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            color: true,
                        },
                    },
                    attachments: {
                        select: {
                            id: true,
                            url: true,
                            filename: true,
                            mimeType: true,
                            fileType: true,
                            size: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.tag.findMany({
                where: { userId },
                include: {
                    parent: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    children: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.userPreferences.findUnique({
                where: { userId },
            }),
        ]);

        const exportData = {
            exportedAt: new Date().toISOString(),
            version: "1.0",
            user: {
                ...user,
                preferences,
            },
            notes: notes.map((note) => ({
                ...note,
                // Convert dates to ISO strings
                createdAt: note.createdAt.toISOString(),
                updatedAt: note.updatedAt.toISOString(),
                pinnedAt: note.pinnedAt?.toISOString() || null,
                lastEmbeddedAt: note.lastEmbeddedAt?.toISOString() || null,
                aiProcessedAt: note.aiProcessedAt?.toISOString() || null,
            })),
            tags: tags.map((tag) => ({
                ...tag,
                createdAt: tag.createdAt.toISOString(),
                updatedAt: tag.updatedAt.toISOString(),
                lastUsed: tag.lastUsed.toISOString(),
                deletedAt: tag.deletedAt?.toISOString() || null,
            })),
            statistics: {
                totalNotes: notes.length,
                totalTags: tags.length,
                totalAttachments: notes.reduce((acc, n) => acc + n.attachments.length, 0),
            },
        };

        return NextResponse.json(exportData, {
            headers: {
                "Content-Disposition": `attachment; filename="intellivault-export-${new Date().toISOString().split("T")[0]}.json"`,
            },
        });
    } catch (error) {
        console.error("Error exporting data:", error);
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json(
            { error: "Failed to export data" },
            { status: 500 }
        );
    }
}
