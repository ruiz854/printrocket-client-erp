// Plantilla para una función cliente del ERP. Guardar la clave local en la
// configuración del navegador de la PC de caja; jamás en el repositorio.
export async function openCashDrawer(localApiToken: string, port = 8790): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${port}/api/drawer/open`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Local-Token": localApiToken,
    },
    body: "{}",
  });
  if (!response.ok) throw new Error(`No se pudo abrir la gaveta (HTTP ${response.status})`);
}
