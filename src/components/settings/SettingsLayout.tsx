"use client";

import { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

interface SettingsSectionProps {
    title: string;
    description?: string;
    children: ReactNode;
}

/**
 * Reusable settings section wrapper with title and description
 */
export function SettingsSection({
    title,
    description,
    children,
}: SettingsSectionProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold">{title}</h2>
                {description && (
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                )}
            </div>
            <Separator />
            <div className="space-y-6">{children}</div>
        </div>
    );
}

interface SettingsItemProps {
    label: string;
    description?: string;
    children: ReactNode;
    className?: string;
}

/**
 * Individual settings item with label and control
 */
export function SettingsItem({
    label,
    description,
    children,
    className,
}: SettingsItemProps) {
    return (
        <div className={`flex items-start justify-between gap-4 ${className || ""}`}>
            <div className="flex-1 space-y-0.5">
                <label className="text-sm font-medium">{label}</label>
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                )}
            </div>
            <div className="flex-shrink-0">{children}</div>
        </div>
    );
}

interface SettingsGroupProps {
    title?: string;
    children: ReactNode;
}

/**
 * Group of related settings items
 */
export function SettingsGroup({ title, children }: SettingsGroupProps) {
    return (
        <div className="space-y-4">
            {title && (
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {title}
                </h3>
            )}
            <div className="space-y-4">{children}</div>
        </div>
    );
}
