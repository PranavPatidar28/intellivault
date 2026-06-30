"use client";

import { Home, Inbox, Settings, FolderOpen, Sparkles, Tag, Vault } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "./ui/separator";
import { NavUser } from "./NavUser";
import { AuthenticatedSession } from "@/lib/session";

// Menu items.
const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "AI Dump",
    url: "/aidump",
    icon: Sparkles,
  },
  {
    title: "Notes",
    url: "/notes",
    icon: Inbox,
  },
  {
    title: "Tags",
    url: "/tags",
    icon: Tag,
  },
  {
    title: "Media",
    url: "/media",
    icon: FolderOpen,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

interface AppSidebarProps {
  session: AuthenticatedSession;
}

export function AppSidebar({ session }: AppSidebarProps) {
  const sidebarContext = useSidebar();
  const pathname = usePathname();

  const { name, email, image } = session.user;

  return (
    <Sidebar collapsible="icon">
      <div className="flex h-12 items-center justify-between overflow-clip">
        {sidebarContext.open ? (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 group/brand"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-transform group-hover/brand:scale-105">
              <Vault className="size-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              IntelliVault
            </span>
          </Link>
        ) : null}
        <SidebarTrigger className="m-2.5" />
      </div>
      <Separator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                // Dashboard is an exact match; section roots also highlight on
                // their sub-routes (e.g. /notes/<id> keeps "Notes" active).
                const isActive =
                  item.url === "/dashboard"
                    ? pathname === item.url
                    : pathname === item.url ||
                      pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser name={name} email={email} image={image || undefined} />
      </SidebarFooter>
    </Sidebar>
  );
}
