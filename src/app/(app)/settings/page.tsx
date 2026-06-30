"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    User,
    Palette,
    Brain,
    FileText,
    Tag,
    Shield,
    ChevronLeft,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { AISettings } from "@/components/settings/AISettings";
import { NotesSettings } from "@/components/settings/NotesSettings";
import { TagsSettings } from "@/components/settings/TagsSettings";
import { DataPrivacySettings } from "@/components/settings/DataPrivacySettings";

type SettingsSection =
    | "account"
    | "appearance"
    | "ai"
    | "notes"
    | "tags"
    | "privacy";

const sections = [
    { id: "account" as const, label: "Account", icon: User },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
    { id: "ai" as const, label: "AI Features", icon: Brain },
    { id: "notes" as const, label: "Notes & Editor", icon: FileText },
    { id: "tags" as const, label: "Tags", icon: Tag },
    { id: "privacy" as const, label: "Data & Privacy", icon: Shield },
];

export default function SettingsPage() {
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<SettingsSection>("account");

    const renderContent = () => {
        switch (activeSection) {
            case "account":
                return <AccountSettings />;
            case "appearance":
                return <AppearanceSettings />;
            case "ai":
                return <AISettings />;
            case "notes":
                return <NotesSettings />;
            case "tags":
                return <TagsSettings />;
            case "privacy":
                return <DataPrivacySettings />;
            default:
                return null;
        }
    };

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <Topbar className="flex-shrink-0">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => router.back()}
                        aria-label="Go back"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Go back</span>
                    </Button>
                    <h1 className="text-lg font-semibold">Settings</h1>
                </div>
            </Topbar>

            {/* Main Content */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Sidebar Navigation (desktop) */}
                <aside className="hidden md:block w-56 flex-shrink-0 border-r bg-muted/20 overflow-y-auto">
                    <nav className="p-4 space-y-1" aria-label="Settings sections">
                        {sections.map((section) => {
                            const Icon = section.icon;
                            const isActive = activeSection === section.id;
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    aria-current={isActive ? "page" : undefined}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                        isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {section.label}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto">
                    {/* Section selector (mobile) */}
                    <nav
                        className="md:hidden flex gap-2 overflow-x-auto border-b bg-muted/20 px-4 py-3"
                        aria-label="Settings sections"
                    >
                        {sections.map((section) => {
                            const Icon = section.icon;
                            const isActive = activeSection === section.id;
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    aria-current={isActive ? "page" : undefined}
                                    className={cn(
                                        "flex flex-shrink-0 items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                                        isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {section.label}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="max-w-2xl mx-auto p-6">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
}
