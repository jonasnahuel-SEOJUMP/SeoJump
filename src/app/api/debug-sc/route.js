import { NextResponse } from "next/server"
import { auth } from "../../../auth"
import { requireAdmin } from "../../../lib/adminGuard"

export async function GET() {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const session = await auth()

  if (!session?.accessToken) {
    return Response.json({ error: "No hay sesión activa" }, { status: 401 })
  }

  try {
    const response = await fetch(
      "https://www.googleapis.com/webmasters/v3/sites",
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      return Response.json({ error: errorData }, { status: response.status })
    }

    const data = await response.json()
    return Response.json({
      properties: data.siteEntry || [],
      accessToken_preview: session.accessToken?.slice(0, 20) + "...",
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
