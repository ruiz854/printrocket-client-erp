// Plantilla para lib/printing/queue-sale-ticket.ts de Diamonds y Amazing.
// Requiere los modelos de templates/prisma-models.prisma y la migración SQL.
import { prisma } from "@/lib/prisma";
import { buildTicket } from "@/lib/printing/ticket";

export async function queueSaleTicket(saleId: string, requestId = `sale:${saleId}:original`) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: true,
      user: { select: { name: true } },
      customer: { select: { name: true } },
      store: { select: { name: true, business_name: true, trade_name: true, address: true, tax_id: true, nrc: true, phone: true } },
      dte: { select: { numero_control: true, codigo_generacion: true, sello_recepcion: true, fecha_emision: true, ambiente: true, is_contingency: true, json_dte: true } },
    },
  });
  if (!sale || sale.status !== "COMPLETADA") throw new Error("Venta no encontrada o no completada");
  const device = await prisma.printDevice.findFirst({ where: { active: true }, orderBy: { created_at: "asc" } });
  if (!device) throw new Error("No hay una impresora registrada para este ERP");

  const jsonDte = sale.dte?.json_dte as Record<string, unknown> | null;
  const resumen = jsonDte?.resumen as Record<string, unknown> | undefined;
  const payload = buildTicket({
    mode: sale.dte ? (sale.dte.is_contingency ? "contingencia" : "dte") : "provisional",
    store: {
      name: sale.store.trade_name ?? sale.store.name,
      business_name: sale.store.business_name,
      nit: sale.store.tax_id,
      nrc: sale.store.nrc,
      address: sale.store.address,
      phone: sale.store.phone,
      mh_enabled: sale.mh_enabled_at_sale,
    },
    sale_id: sale.id,
    created_at: sale.created_at.toISOString(),
    customer_name: sale.customer?.name ?? "Consumidor final",
    items: sale.items.map(item => ({
      quantity: item.quantity,
      description: item.product_name,
      size: item.size,
      color: item.color,
      unit_price: Number(item.unit_price),
      total: Number(item.total),
    })),
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    tax: Number(sale.tax),
    total: Number(sale.total),
    payment_method: sale.payment_method,
    amount_received: sale.amount_received != null ? Number(sale.amount_received) : Number(sale.total),
    change: sale.change_amount != null ? Number(sale.change_amount) : null,
    total_words: typeof resumen?.totalLetras === "string" ? resumen.totalLetras : null,
    seller_name: sale.user.name,
    dte: sale.dte ? {
      numero_control: sale.dte.numero_control ?? "",
      codigo_generacion: sale.dte.codigo_generacion ?? "",
      sello_recepcion: sale.dte.sello_recepcion,
      fecha_emision: sale.dte.fecha_emision?.toISOString() ?? null,
      ambiente: sale.dte.ambiente,
    } : null,
    width_mm: 80,
  });

  // El navegador abrirá la gaveta al confirmar EFECTIVO. El ticket no debe
  // contener ESC p: quitar p.openDrawer() de lib/printing/ticket.ts.
  return prisma.printJob.upsert({
    where: { request_id: requestId },
    create: {
      device_user_id: device.user_id,
      request_id: requestId,
      sale_id: sale.id,
      payload_base64: Buffer.from(payload).toString("base64"),
      status: "pending",
    },
    update: {},
    select: { id: true, status: true },
  });
}
