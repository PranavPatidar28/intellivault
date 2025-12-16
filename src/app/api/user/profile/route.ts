import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

/**
 * GET /api/user/profile
 * Fetch user profile information
 */
export async function GET() {
    try {
        const session = await requireAuth();
        const userId = session.user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                emailVerified: true,
                createdAt: true,
                accounts: {
                    select: {
                        providerId: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("Error fetching profile:", error);
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json(
            { error: "Failed to fetch profile" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/user/profile
 * Update user profile (name, image)
 */
export async function PATCH(request: Request) {
    try {
        const session = await requireAuth();
        const userId = session.user.id;

        const body = await request.json();
        const { name, image } = body;

        // Validate name
        if (name !== undefined && (typeof name !== "string" || name.trim().length < 1)) {
            return NextResponse.json(
                { error: "Name must be a non-empty string" },
                { status: 400 }
            );
        }

        const updateData: { name?: string; image?: string | null } = {};
        if (name !== undefined) updateData.name = name.trim();
        if (image !== undefined) updateData.image = image;

        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                emailVerified: true,
                createdAt: true,
            },
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error("Error updating profile:", error);
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json(
            { error: "Failed to update profile" },
            { status: 500 }
        );
    }
}
