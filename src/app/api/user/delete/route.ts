import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { handleNoteDeleted } from "@/lib/ai/embedding-sync";

/**
 * DELETE /api/user/delete
 * Permanently delete user account and all associated data
 */
export async function DELETE(request: Request) {
    try {
        const session = await requireAuth();
        const userId = session.user.id;

        // Verify with confirmation phrase
        const body = await request.json();
        const { confirmPhrase } = body;

        if (confirmPhrase !== "DELETE MY ACCOUNT") {
            return NextResponse.json(
                { error: "Please type 'DELETE MY ACCOUNT' to confirm" },
                { status: 400 }
            );
        }

        // Collect external resources (Pinecone vectors + Blob files) BEFORE the
        // DB rows are removed, so we can purge them afterwards. Account deletion
        // must fully erase the user's data from third-party stores (GDPR), not
        // just Postgres.
        const [notesToPurge, attachmentsToPurge] = await Promise.all([
            prisma.note.findMany({
                where: { userId },
                select: { id: true, chunkCount: true },
            }),
            prisma.mediaAttachment.findMany({
                where: { userId },
                select: { url: true },
            }),
        ]);

        // Delete all user data in order (due to foreign key constraints)
        await prisma.$transaction(async (tx) => {
            // Delete media attachments
            await tx.mediaAttachment.deleteMany({ where: { userId } });

            // Delete notes (this will cascade to note-tag relations)
            await tx.note.deleteMany({ where: { userId } });

            // Delete tag relations
            await tx.tagRelation.deleteMany({
                where: {
                    OR: [
                        { from: { userId } },
                        { to: { userId } },
                    ],
                },
            });

            // Delete tags
            await tx.tag.deleteMany({ where: { userId } });

            // Delete preferences
            await tx.userPreferences.deleteMany({ where: { userId } });

            // Delete sessions
            await tx.session.deleteMany({ where: { userId } });

            // Delete accounts (OAuth)
            await tx.account.deleteMany({ where: { userId } });

            // Finally delete the user
            await tx.user.delete({ where: { id: userId } });
        });

        // Purge external resources after the DB transaction commits. Failures
        // here are logged but must NOT roll back the account deletion (the rows
        // are already gone). Do NOT drop the Pinecone namespace — it is shared
        // across all users, so we delete this user's vectors note-by-note.
        await Promise.allSettled(
            notesToPurge.map((note) =>
                handleNoteDeleted(note.id, userId, note.chunkCount ?? undefined)
            )
        );

        if (attachmentsToPurge.length > 0) {
            try {
                await del(attachmentsToPurge.map((a) => a.url));
            } catch (blobError) {
                console.error("Failed to delete some blobs during account deletion:", blobError);
            }
        }

        // Sign out the user
        try {
            await auth.api.signOut({
                headers: await headers(),
            });
        } catch {
            // Ignore signout errors since user is deleted
        }

        return NextResponse.json({
            success: true,
            message: "Account and all data have been permanently deleted",
        });
    } catch (error) {
        console.error("Error deleting account:", error);
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json(
            { error: "Failed to delete account" },
            { status: 500 }
        );
    }
}
