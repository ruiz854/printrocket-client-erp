# Integración de Diamonds, Amazing y nuevos ERP

Este documento es la plantilla de integración. **No modifica los repositorios ERP.** Diamonds es la base del producto: implementa y valida allí primero; propaga el cambio a Amazing manteniendo secretos y datos separados.

## 1. Cola por proyecto Supabase

Ejecuta `templates/supabase-print-queue.sql` como migración en el proyecto del ERP y añade `templates/prisma-models.prisma` a su `prisma/schema.prisma`. Crea un usuario Auth exclusivo para la PC y regístralo en `print_devices` según `CONFIGURACION.md`. La PC solo puede leer sus trabajos y ejecutar las funciones de tomar, confirmar o resolver; las escrituras iniciales las realiza el servidor ERP mediante Prisma.

El ERP y la PC usan el **mismo proyecto Supabase** de ese negocio. No hacen falta Edge Functions ni otro servidor para impresión. El identificador `request_id` evita que una petición repetida cree dos tickets originales.
La cola admite tickets de venta (`sale_id`) y de corte de caja (`cash_session_id`). Cada trabajo corresponde a uno de los dos.

## 2. Encolar al confirmar un cobro

Coloca `templates/erp/queue-sale-ticket.ts` en `lib/printing/queue-sale-ticket.ts`. Usa el generador ESC/POS actual y guarda los bytes en Base64. Quita `p.openDrawer()` de `lib/printing/ticket.ts`: la gaveta se controla por separado.

En `components/modules/venta-module.tsx`, el punto actual está después de `createSale(saleInput)` y del intento de `generarDTEDesdeVenta(...)`. Sustituye `void printReceiptTicket(sale.id, ticket)` por una llamada autenticada al servidor que invoque `queueSaleTicket(sale.id)`. No invoques la cola antes de confirmar la venta. La pantalla debe decir **En cola** al recibir el ID del trabajo, no **Impreso**. Si falla el encolado, conserva la venta y muestra un botón de reintento con el mismo `request_id`.

La ruta actual `app/api/ventas/[id]/print-cloud/route.ts` ya autentica al usuario y construye el ticket. Puede adaptarse para llamar a `queueSaleTicket(id)` en vez de hacer `fetch` a Cloud Run; elimina la validación de `printer_endpoint_url` para este modo. Revisa también `app/(pos)/imprimir/[id]/page.tsx` para que `?print=1` y el cobro no creen dos trabajos. Una reimpresión explícita debe usar un `request_id` nuevo, por ejemplo `sale:<id>:copy:<uuid>`.

## 3. Gaveta en efectivo

Usa `templates/erp/open-drawer.ts` en el navegador de **la misma PC** de caja. Después de que `createSale` confirme una venta con `payment_method === "EFECTIVO"`, llama a `openCashDrawer(...)`. Si la venta se guardó sin internet, llama después de guardar el borrador en IndexedDB. La clave local se configura en ese navegador por el administrador; no la guardes en GitHub ni la incluyas en el bundle público. Muestra un error de gaveta y una acción para reintentar si el navegador deniega el permiso local; no reviertas la venta.

Chrome puede pedir permiso de acceso a la red local para conectar la web HTTPS con `127.0.0.1`. Prueba ese permiso en la PC real antes de operar. La API local solo acepta el origen configurado y `X-Local-Token`.

## 4. Ventas sin internet

El flujo actual `completeOfflineSale()` guarda la venta en IndexedDB y llama de inmediato a `printReceiptTicket`. Para este modo, guarda la venta y abre la gaveta si es efectivo, pero **no** intentes enviar un ticket a Supabase mientras no haya internet.

En `app/actions/dte-contingencia.ts`, `syncOneContingencySale` crea o encuentra la venta/DTE al reconectar. Encola el ticket con `queueSaleTicket(saleId, \`sale:${saleId}:original\`)` **antes** de devolver `ok: true`, también en la rama que encuentra un DTE existente. Si la cola falla, devuelve error de sincronización para mantener el borrador en IndexedDB y reintentar después. La clave estable impide duplicados en esos reintentos.

## 5. Estados, pruebas y mantenimiento

Al cerrar una sesión de caja, encola el ticket de arqueo con `request_id = cash:<id>:original`. El cierre contable debe quedar guardado aunque falle la cola; muestra un reintento. Desde el historial, una reimpresión usa `cash:<id>:copy:<uuid>` y nunca manda un pulso de gaveta. El generador del corte debe ejecutarse en el servidor con el resumen y conteos de la sesión cerrada.

El cliente confirma el trabajo cuando Windows acepta los bytes; si el resultado es incierto, el panel permite marcarlo como impreso o reimprimirlo. No abras la gaveta con el ticket o la reimpresión. Prueba efectivo, tarjeta, error de impresora, PC apagada, reconexión, contingencia y reintento de una venta ya sincronizada.

El servidor ERP debe eliminar trabajos **impresos** de más de 30 días durante su mantenimiento normal. No uses una tarea que borre pendientes o inciertos. Vigila el espacio de base de datos y mensajes Realtime del plan Supabase del ERP.
