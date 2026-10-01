# PrintRocket Client ERP

Cliente genérico de impresión USB para Windows. Cada ERP usa una cola en **su propio proyecto Supabase**. El cliente recibe los tickets en tiempo real, los envía en modo RAW a la impresora térmica y muestra un panel local. Este proyecto es independiente del cliente y Cloud Run de Farmacia.

## Descargar e instalar

1. Descarga `PrintRocketClient-Setup.exe` desde [la última versión](https://github.com/ruiz854/printrocket-client-erp/releases/latest). No se necesita Git ni Node.js en la PC.
2. Instala la impresora térmica en Windows y confirma que aparece en **Impresoras y escáneres**.
3. Prepara el archivo privado del negocio según [Configuración del proyecto](docs/CONFIGURACION.md). Guárdalo fuera de GitHub.
4. Ejecuta el instalador como administrador. Selecciona el archivo privado y luego la impresora USB. El instalador crea el servicio `PrintRocketClient` y el acceso **Panel Impresion PrintRocket** en el escritorio.
5. Abre el panel, comprueba la conexión y pulsa **Ticket de prueba**. En una actualización, ejecuta el instalador nuevo: conserva `config.json` y `state.json` en `%ProgramData%\PrintRocket`.

El instalador no se actualiza solo. La descarga pública contiene código, dependencias y Node.js; **no contiene claves de ningún negocio**. El ejecutable inicial no tiene firma comercial, por lo que Windows puede mostrar una advertencia de editor desconocido.

## Funcionamiento

- El panel escucha solo en `127.0.0.1:8790` y muestra nombre, logo y color del negocio, conexión, trabajos, errores y registro reciente.
- Supabase Realtime avisa al cliente de nuevos trabajos. Tras reconectar, el cliente revisa la cola; una comprobación cada dos minutos cubre avisos perdidos.
- Un trabajo solo se marca como impreso después de que Windows acepte sus bytes en la cola de impresión. Esto **no confirma físicamente** que salió papel. Un reinicio o error durante la impresión deja el trabajo como **incierto** para revisión manual.
- La gaveta tiene una orden local separada (`POST /api/drawer/open`). El ERP debe llamarla únicamente al confirmar un cobro en efectivo. El ticket de venta y las reimpresiones no deben incluir el comando de apertura.
- Si la venta se guarda sin internet, la gaveta puede abrirse desde el navegador en esa misma PC; el ticket entra en cola cuando la venta se sincroniza.

## Plantilla para los ERP

Lee [Integración de Diamonds y Amazing](docs/INTEGRACION_ERP.md). Incluye la migración SQL, los modelos Prisma y ejemplos TypeScript. **La integración no se ha aplicado todavía a Diamonds ni a Amazing.** Primero se modifica y valida Diamonds; después se propaga a Amazing. Farmacia queda fuera del alcance.

## Desarrollo

```bash
npm ci
npm test
PRINTROCKET_CONFIG=/ruta/config.json npm start
```

En macOS/Linux el panel y la conexión pueden arrancar para desarrollo, pero la impresión RAW requiere Windows. El instalador se compila en GitHub Actions sobre Windows con NSIS. Para generar un instalador localmente en Windows: `powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1`.

## Licencias y límites

El instalador usa [NSIS](https://nsis.sourceforge.io/Docs/Chapter1.html) y [WinSW](https://github.com/winsw/winsw) para registrar el servicio. El uso de Supabase se suma al consumo existente de cada ERP. Vigila la cuota gratuita y elimina trabajos impresos antiguos desde el servidor del ERP; los pendientes e inciertos nunca deben eliminarse automáticamente.
