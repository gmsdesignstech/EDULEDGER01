import { z } from "zod";
import { currentUser } from "@/lib/session";
import { failWhatsAppAddon, findWhatsAppAddonByOrder } from "@/lib/db";

const schema = z.object({ orderId: z.string().min(1) });

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "SCHOOL_ADMIN" || !user.institutionId)
    return Response.json({ error: "Only a school administrator can cancel this purchase." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid order" }, { status: 400 });
  const order = await findWhatsAppAddonByOrder(parsed.data.orderId);
  if (!order || order.institutionId !== user.institutionId)
    return Response.json({ error: "Order not found" }, { status: 404 });
  await failWhatsAppAddon(parsed.data.orderId, "CANCELLED");
  return Response.json({ cancelled: true });
}
