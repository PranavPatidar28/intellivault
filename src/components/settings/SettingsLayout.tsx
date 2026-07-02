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
    /**
     * id of the control this item labels. When provided, the label is
     * programmatically associated with the control (clickable + announced by
     * screen readers). Omit for items whose control is not a single focusable
     * element (e.g. a button group).
     */
    htmlFor?: string;
}

/**
 * Individual settings item with label and control
 */
export function SettingsItem({
    label,
    description,
    children,
    className,
    htmlFor,
}: SettingsItemProps) {
    return (
        <div className={`flex items-start justify-between gap-4 ${className || ""}`}>
            <div className="flex-1 space-y-0.5">
                <label htmlFor={htmlFor} className="text-sm font-medium">
                    {label}
                </label>
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                )}
            </div>
            <div className="flex-shrink-0">{children}</div>
        </div>
    );
}

interface SettingsGroupProps {
    title?: ReactNode;
    children: ReactNode;
}

/**
 * Group of related settings items, presented as a card surface.
 */
export function SettingsGroup({ title, children }: SettingsGroupProps) {
    return (
        <div className="space-y-3">
            {title && (
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {title}
                </div>
            )}
            <div className="space-y-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
                {children}
            </div>
        </div>
    );
}
