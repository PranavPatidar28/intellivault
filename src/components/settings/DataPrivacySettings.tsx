"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Download,
    Upload,
    Trash2,
    AlertTriangle,
    Loader2,
    FileJson,
    Shield,
} from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import {
    SettingsSection,
    SettingsItem,
    SettingsGroup,
} from "./SettingsLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert";

export function DataPrivacySettings() {
    const router = useRouter();
    const { toast } = useToast();
    const { preferences, isLoading, updatePreferences } = useSettings();

    const [isExporting, setIsExporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const handleExportData = async () => {
        setIsExporting(true);
        try {
            const response = await fetch("/api/user/export", {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error("Failed to export data");
            }

            const data = await response.json();

            // Create and download the file
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `intellivault-export-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast({
                title: "Export successful",
                description: `Exported ${data.statistics.totalNotes} notes and ${data.statistics.totalTags} tags.`,
            });
        } catch (error) {
            console.error("Export error:", error);
            toast({
                title: "Export failed",
                description: "Failed to export your data. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmation !== "DELETE MY ACCOUNT") {
            toast({
                title: "Confirmation required",
                description: "Please type 'DELETE MY ACCOUNT' exactly to confirm.",
                variant: "destructive",
            });
            return;
        }

        setIsDeleting(true);
        try {
            const response = await fetch("/api/user/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmPhrase: deleteConfirmation }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to delete account");
            }

            toast({
                title: "Account deleted",
                description: "Your account and all data have been permanently deleted.",
            });

            // Redirect to home page
            router.push("/");
        } catch (error) {
            console.error("Delete account error:", error);
            toast({
                title: "Deletion failed",
                description:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete account. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
            setDeleteConfirmation("");
        }
    };

    if (isLoading) {
        return (
            <SettingsSection
                title="Data & Privacy"
                description="Manage your data and privacy settings"
            >
                <div className="space-y-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection
            title="Data & Privacy"
            description="Manage your data, exports, and privacy settings"
        >
            {/* Data Management */}
            <SettingsGroup title="Data Management">
                <SettingsItem
                    label="Export Data"
                    description="Download all your notes, tags, and settings as JSON"
                >
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportData}
                        disabled={isExporting}
                        className="gap-2"
                    >
                        {isExporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        Export
                    </Button>
                </SettingsItem>
            </SettingsGroup>

            {/* Privacy */}
            <SettingsGroup title="Privacy">
                <SettingsItem
                    label="Analytics"
                    description="Help improve IntelliVault by sharing anonymous usage data"
                >
                    <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={preferences?.analyticsEnabled ?? true}
                        onChange={(e) =>
                            updatePreferences({ analyticsEnabled: e.target.checked })
                        }
                    />
                </SettingsItem>
            </SettingsGroup>

            {/* Danger Zone */}
            <SettingsGroup title="Danger Zone">
                <Alert variant="destructive" className="bg-destructive/5">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Delete Account</AlertTitle>
                    <AlertDescription className="mt-2">
                        <p className="text-sm mb-4">
                            Permanently delete your account and all associated data. This
                            action cannot be undone.
                        </p>
                        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                            <DialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="gap-2">
                                    <Trash2 className="h-4 w-4" />
                                    Delete Account
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-destructive">
                                        <AlertTriangle className="h-5 w-5" />
                                        Delete Account
                                    </DialogTitle>
                                    <DialogDescription>
                                        This action is permanent and cannot be undone. All your
                                        data will be permanently deleted including:
                                    </DialogDescription>
                                </DialogHeader>

                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 my-4">
                                    <li>All notes and their content</li>
                                    <li>All tags and tag relationships</li>
                                    <li>All media attachments</li>
                                    <li>Your account and preferences</li>
                                    <li>All sessions and connected accounts</li>
                                </ul>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        Type <span className="font-mono">DELETE MY ACCOUNT</span> to
                                        confirm:
                                    </label>
                                    <Input
                                        value={deleteConfirmation}
                                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                                        placeholder="DELETE MY ACCOUNT"
                                        className="font-mono"
                                    />
                                </div>

                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowDeleteDialog(false);
                                            setDeleteConfirmation("");
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleDeleteAccount}
                                        disabled={
                                            isDeleting || deleteConfirmation !== "DELETE MY ACCOUNT"
                                        }
                                    >
                                        {isDeleting ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Trash2 className="h-4 w-4 mr-2" />
                                        )}
                                        Delete Forever
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </AlertDescription>
                </Alert>
            </SettingsGroup>
        </SettingsSection>
    );
}
