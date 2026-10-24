# CLIENTE DE IMPRESIÓN EN WINDOWS (SERVICIO PERMANENTE)

Reemplaza al cliente de Termux/Android. Ya no se cierra solo, arranca con el
PC y se reinicia automáticamente si falla.

## CÓMO FUNCIONA

1. El servicio consulta la nube cada 1.5 segundos:
   https://printer-server-amazing-385691088146.us-central1.run.app/next-job
2. Cuando hay un trabajo, lo imprime directo en la impresora **POS-80C**
   conectada por USB (vía el spooler de Windows en modo RAW).
3. No necesita IP de impresora ni puerto 9100.

## ARCHIVOS

| Archivo             | Función                                        |
|---------------------|------------------------------------------------|
| `client.js`         | Programa principal (bucle de impresión)        |
| `config.json`       | Configuración (URL nube, nombre impresora)     |
| `print.ps1`         | Envía bytes crudos a la impresora por Windows  |
| `svc-install.cjs`   | Instala el servicio de Windows                 |
| `svc-uninstall.cjs`  | Desinstala el servicio                         |
| `daemon\`           | Logs y ejecutable del servicio (auto-generado) |

## SERVICIO DE WINDOWS

- Nombre: `PrinterClientAmazing`
- Estado: consulte con `Get-Service PrinterClientAmazing`
- Inicio: Automático (arranca cuando enciende el PC)

## PANEL VISUAL DE ESTADO

Doble clic al acceso del escritorio: **Panel Impresion Amazing**
(abre http://localhost:8790 en el navegador).

Muestra:
- Estado del servicio (en línea / sin conexión)
- Estado de la conexión con la nube
- Trabajos impresos, último trabajo y errores
- Log en vivo del servicio

Botones del panel:
- **Imprimir ticket de prueba**: imprime un ticket de verificación
- **Actualizar ahora**
- **Reiniciar servicio**: reinicia el sistema de impresión en ~5 segundos

## SI EL PANEL DICE "Servicio detenido"

Doble clic al ícono del escritorio **REPARAR Impresion Amazing**,
aceptar la ventana de Windows (Sí), y luego abrir el panel normal.
No se necesita escribir ningún comando.

## OPERACIONES COMUNES

### Ver si está corriendo
```powershell
Get-Service PrinterClientAmazing
```

### Reiniciar el servicio
```powershell
Restart-Service PrinterClientAmazing
```
(Si PowerShell normal lo bloquea por permisos, abrir PowerShell como
Administrador.)

### Ver los logs
```powershell
Get-Content "$env:USERPROFILE\OneDrive\Documentos\ImpresionTermicaAmazing\printer-client\daemon\printerclientamazing_out.log" -Tail 30 -Wait
```

### Imprimir un ticket de prueba manualmente
```powershell
cd "$env:USERPROFILE\OneDrive\Documentos\ImpresionTermicaAmazing\printer-client"
$txt = "PRUEBA`n`n`n`n`n" + [char]0x1D + [char]0x56 + [char]0x00
[System.IO.File]::WriteAllBytes("$env:TEMP\t.bin", [System.Text.Encoding]::UTF8.GetBytes($txt))
powershell -NoProfile -ExecutionPolicy Bypass -File .\print.ps1 -PrinterName "POS-80C" -FilePath "$env:TEMP\t.bin"
```

### Cambiar configuración (impresora o nube)
Editar `config.json` y reiniciar:
```powershell
Restart-Service PrinterClientAmazing
```

### Detener / iniciar manualmente
```powershell
Stop-Service PrinterClientAmazing
Start-Service PrinterClientAmazing
```

### Desinstalar el servicio
En PowerShell como Administrador:
```powershell
cd "$env:USERPROFILE\OneDrive\Documentos\ImpresionTermicaAmazing\printer-client"
& "C:\Program Files\nodejs\node.exe" svc-uninstall.cjs
```

## SI NO IMPRIME

1. Verifique que la impresora esté encendida y con papel.
2. Verifique que aparezca en Windows:
   ```powershell
   Get-Printer POS-80C
   ```
3. Imprima un ticket de prueba (comando de arriba).
4. Revise los logs del servicio.
5. Reinicie el servicio.
6. Si cambió el nombre de la impresora en Windows, actualice
   `printerName` en `config.json`.

## APPS SCRIPT — PRINTER_ENDPOINT

```
https://printer-server-amazing-385691088146.us-central1.run.app/print
```

## REQUISITOS YA INSTALADOS

- Node.js v24 LTS (instalado con winget)
- Dependencias npm (`node-windows`) ya instaladas en esta carpeta
