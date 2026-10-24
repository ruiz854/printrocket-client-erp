# Configuración de un negocio

Esta tarea la realiza el administrador una vez por proyecto ERP. No se crea un servicio Cloud Run ni un proyecto Supabase adicional.

1. En el Supabase **del ERP**, ejecuta `templates/supabase-print-queue.sql` en SQL Editor. Si el proyecto usa migraciones Prisma, versiona el SQL como migración y añade los modelos de `templates/prisma-models.prisma` al esquema de Diamonds antes de propagarlo.
2. En Supabase Auth crea un usuario exclusivo para la PC de impresión con correo y contraseña fuerte; confirma el correo desde el panel de administración. Copia su UUID.
3. Registra el dispositivo: `insert into public.print_devices (user_id, label) values ('UUID_DEL_USUARIO', 'Impresora principal');`. No uses la cuenta de un cajero.
4. Copia `config.example.json` a un archivo privado, por ejemplo `Amazing-impresora.json`. Llena `supabaseUrl`, la **publishable/anon key**, el correo y contraseña del dispositivo, nombre y colores. Genera `localApiToken` con al menos 32 caracteres aleatorios. Nunca pongas la **service_role/secret key** en la PC.
5. Añade el dominio HTTPS exacto del ERP a `allowedOrigins`. El instalador permitirá elegir el nombre de la impresora instalada y copiará el logo al área de datos local.
6. Entrega ese archivo al administrador de la PC por un canal privado; no lo subas al repositorio ni lo compartas por una URL pública. Tras instalar, elimina copias innecesarias del archivo.

El servicio guarda configuración y estado en `%ProgramData%\PrintRocket`. Solo Administradores y SYSTEM pueden leer `config.json`. El panel local queda en `http://127.0.0.1:8790` por defecto. Para abrir la gaveta desde el ERP, el navegador de esa PC necesita la misma `localApiToken` y puede requerir permiso de acceso a la red local en Chrome.

Para cambiar de impresora o negocio, detén `PrintRocketClient`, reemplaza la configuración privada con permisos adecuados y vuelve a iniciar el servicio. Una instalación nueva ejecuta el asistente de importación; las actualizaciones conservan la configuración existente.
