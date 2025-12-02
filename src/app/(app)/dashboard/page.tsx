
import { Topbar } from "@/components/Topbar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session) {
    redirect("/signin");
  }

  return (
    <div>
      <Topbar>
        <div className="p-2 text-2xl">Dashboard</div>
      </Topbar>
      <div className="p-4">
        <h1 className="text-2xl">Welcome, {session.user.name}!</h1>
      </div>
    </div>
  );
}