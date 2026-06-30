"use client";

import { useState } from "react";
import { Loader2, LogOut, Trash2 } from "lucide-react";
import { useProfile } from "@/hooks/use-settings";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
    SettingsSection,
    SettingsItem,
    SettingsGroup,
} from "./SettingsLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export function AccountSettings() {
    const { profile, isLoading, updateProfile } = useProfile();
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const [isSavingName, setIsSavingName] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleEditName = () => {
        if (profile) {
            setEditedName(profile.name);
            setNameError(null);
            setIsEditing(true);
        }
    };

    const handleSaveName = async () => {
        if (isSavingName) return;
        const trimmed = editedName.trim();
        if (!trimmed) {
            setNameError("Name cannot be empty.");
            return;
        }
        setNameError(null);
        setIsSavingName(true);
        try {
            await updateProfile({ name: trimmed });
            setIsEditing(false);
        } finally {
            setIsSavingName(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setNameError(null);
    };

    const handleSignOut = async () => {
        setIsSigningOut(true);
        try {
            await authClient.signOut();
            router.push("/signin");
        } catch (error) {
            console.error("Sign out error:", error);
        } finally {
            setIsSigningOut(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    if (isLoading) {
        return (
            <SettingsSection title="Account" description="Manage your account settings">
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                    </div>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </SettingsSection>
        );
    }

    if (!profile) {
        return (
            <SettingsSection title="Account" description="Manage your account settings">
                <p className="text-sm text-muted-foreground">Failed to load profile</p>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection
            title="Account"
            description="Manage your account settings and profile"
        >
            {/* Profile Section */}
            <SettingsGroup title="Profile">
                <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={profile.image || undefined} alt={profile.name} />
                        <AvatarFallback className="text-lg">
                            {getInitials(profile.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                        {isEditing ? (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={editedName}
                                        onChange={(e) => {
                                            setEditedName(e.target.value);
                                            if (nameError) setNameError(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleSaveName();
                                            } else if (e.key === "Escape") {
                                                e.preventDefault();
                                                handleCancelEdit();
                                            }
                                        }}
                                        className="h-9"
                                        aria-label="Your name"
                                        aria-invalid={!!nameError}
                                        disabled={isSavingName}
                                        autoFocus
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleSaveName}
                                        disabled={isSavingName}
                                    >
                                        {isSavingName && (
                                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                        )}
                                        Save
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleCancelEdit}
                                        disabled={isSavingName}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                                {nameError && (
                                    <p className="text-xs text-destructive" role="alert">
                                        {nameError}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-medium">{profile.name}</h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={handleEditName}
                                    >
                                        Edit
                                    </Button>
                                </div>
                                <p className="text-sm text-muted-foreground">{profile.email}</p>
                            </>
                        )}
                    </div>
                </div>
            </SettingsGroup>

            {/* Connected Accounts */}
            <SettingsGroup title="Connected Accounts">
                <div className="space-y-3">
                    {profile.accounts.map((account) => (
                        <div
                            key={account.providerId}
                            className="flex items-center justify-between p-3 border rounded-lg"
                        >
                            <div className="flex items-center gap-3">
                                {account.providerId === "google" && (
                                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                )}
                                <div>
                                    <p className="text-sm font-medium capitalize">
                                        {account.providerId}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Connected {new Date(account.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <Badge variant="secondary">Connected</Badge>
                        </div>
                    ))}
                    {profile.accounts.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No connected accounts. You&apos;re using email/password login.
                        </p>
                    )}
                </div>
            </SettingsGroup>

            {/* Account Info */}
            <SettingsGroup title="Account Info">
                <SettingsItem
                    label="Email"
                    description="Your email address for signing in"
                >
                    <span className="text-sm text-muted-foreground">{profile.email}</span>
                </SettingsItem>
                <SettingsItem
                    label="Email Verified"
                    description="Whether your email has been verified"
                >
                    <Badge variant={profile.emailVerified ? "default" : "secondary"}>
                        {profile.emailVerified ? "Verified" : "Not Verified"}
                    </Badge>
                </SettingsItem>
                <SettingsItem
                    label="Member Since"
                    description="When you created your account"
                >
                    <span className="text-sm text-muted-foreground">
                        {new Date(profile.createdAt).toLocaleDateString()}
                    </span>
                </SettingsItem>
            </SettingsGroup>

            {/* Actions */}
            <SettingsGroup title="Session">
                <div className="flex flex-col gap-3">
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                    >
                        {isSigningOut ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <LogOut className="h-4 w-4" />
                        )}
                        Sign Out
                    </Button>
                </div>
            </SettingsGroup>
        </SettingsSection>
    );
}
