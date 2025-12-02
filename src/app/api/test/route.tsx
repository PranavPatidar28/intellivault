// app/api/me/route.ts
import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth"; // your Better-Auth instance

export async function GET() {
  // pass Next's Headers and Cookies to Better-Auth
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    console.log("some error")
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }
  console.log(session.user.name)

  return NextResponse.json({ ok: true, user: session.user });
}
