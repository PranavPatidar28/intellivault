import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { DEFAULT_PREFERENCES, type UserPreferencesUpdate } from "@/types/settings";

/**
 * GET /api/user/preferences
 * Fetch user preferences, creating defaults if none exist
 */
export async function GET() {
    try {
        const session = await requireAuth();
        const userId = session.user.id;

        let preferences = await prisma.userPreferences.findUnique({
            where: { userId },
        });

        // Create default preferences if none exist
        if (!preferences) {
            preferences = await prisma.userPreferences.create({
                data: {
                    userId,
                    ...DEFAULT_PREFERENCES,
                },
            });
        }

        return NextResponse.json(preferences);
    } catch (error) {
        console.error("Error fetching preferences:", error);
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json(
            { error: "Failed to fetch preferences" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/user/preferences
 * Update user preferences (partial update)
 */
export async function PATCH(request: Request) {
    try {
        const session = await requireAuth();
        const userId = session.user.id;

        const body: UserPreferencesUpdate = await request.json();

        // Remove any fields that shouldn't be updated directly
        const { ...updateData } = body;

        // Upsert preferences
        const preferences = await prisma.userPreferences.upsert({
            where: { userId },
            create: {
                userId,
                ...DEFAULT_PREFERENCES,
                ...updateData,
            },
            update: updateData,
        });

        return NextResponse.json(preferences);
    } catch (error) {
        console.error("Error updating preferences:", error);
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json(
            { error: "Failed to update preferences" },
            { status: 500 }
        );
    }
}
