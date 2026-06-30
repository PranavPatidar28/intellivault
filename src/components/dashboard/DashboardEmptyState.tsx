import Link from "next/link";
import { FileText, Sparkles, Vault } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function DashboardEmptyState({ name }: { name: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
        <span
          className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Vault className="size-7" />
        </span>
        <div className="max-w-md space-y-1.5">
          <h2 className="text-xl font-semibold">
            Welcome to your vault, {name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Your vault is empty for now. Capture a thought as a note, or let AI
            Dump turn a messy braindump into a structured, tagged note in
            seconds.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/notes">
              <FileText className="size-4" />
              Create your first note
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/aidump">
              <Sparkles className="size-4" />
              Try AI Dump
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
