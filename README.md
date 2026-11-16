# GRIPXELL — Astro y Supabase (Versión 5 — IMEI)

Sistema de órdenes, clientes, teléfonos, créditos, abonos, historial y PDFs.

## Instalación única, sin borrar los datos existentes

1. En [SQL Editor de GRIPXELL](https://supabase.com/dashboard/project/xddcspjdcrjonfowspcp/sql/new), ejecuta **solo** `supabase/00_INSTALAR_TODO_GRIPXELL.sql`. Es el instalador acumulado con todos los cambios de las versiones anteriores. Es compatible con las tablas ya instaladas y no contiene comandos `DROP TABLE` ni `TRUNCATE`. Si instalaste V4, elimina solo la firma de la función que pedía email y la reemplaza por una función sin correo; no borra datos.
2. Coloca `.env` al lado de `package.json`. Copia tu archivo anterior o ejecuta `CONFIGURAR_ENV.bat` y edítalo. Requiere `SUPABASE_URL` sin `/rest/v1/` y `SUPABASE_SECRET_KEY` (clave privada, nunca incluida en el ZIP).
3. Desde Visual Studio Code, abre **GRIPXELL_COMPLETO**, ejecuta `npm.cmd install` y `npm.cmd run dev`.
4. Abre `http://localhost:4321/`.

## Clientes y dispositivos

- **IMEI del teléfono, no correo electrónico:** cada dispositivo tiene su IMEI único de 15 dígitos; permite buscar al cliente por IMEI, nombre o teléfono. Un cliente puede tener múltiples IMEI. El email antiguo, si existe en la base, se conserva por compatibilidad, pero ya no se solicita ni utiliza.
- Al registrar un cliente nuevo se puede agregar su **primer teléfono o dispositivo** (descripción, marca, modelo, IMEI obligatorio para el equipo y precio sugerido). El cliente y equipo se guardan en una única transacción de Supabase.
- En **Clientes > Equipos y órdenes > Agregar otro dispositivo** puedes asociar tantos equipos como necesites al mismo cliente, sin crear duplicados de la persona.
- Se puede dar de baja o reactivar el cliente sin eliminar sus órdenes, pagos ni PDFs. También puedes dar de baja o reactivar un dispositivo; las órdenes históricas permanecen.
- Al crear una nueva orden puedes elegir un dispositivo existente y se rellena su descripción/precio como sugerencia editable. Los accesorios pueden registrarse sin dispositivo vinculado.
- Cada orden mantiene su **propio folio, abonos y saldo** aunque varios equipos pertenezcan al mismo cliente.

## Históricos y reportes

- Pagos con **fecha programada** y **fecha real**, por ejemplo «Sin pago 05/diciembre/2026» y «Pago del 10/diciembre/2026». El movimiento sin pago no afecta el saldo.
- Notas, estados de cuenta PDF con logo GRIPXELL (sin fotografía de teléfono), versiones históricas, descarga y enlace temporal de 24 horas para WhatsApp/correo.
- Exportación CSV de órdenes, clientes, **dispositivos** y abonos.

## Tablas

`clientes`, `dispositivos`, `ordenes`, `orden_detalles`, `abonos`, `documentos`, `historial_movimientos`. Bucket privado `gripxell-documentos`.

Los documentos reales se generan después de guardar una orden o abono; el SQL crea la estructura de almacenamiento. El servicio de WhatsApp/correo abre la aplicación para que el usuario confirme el envío, no envía automáticamente mensajes.

## Seguridad

La interfaz **no tiene login**, según lo solicitado. Astro se conecta a Supabase desde servidor con `sb_secret_`. La app solo debe ejecutarse en localhost, una red privada o detrás de VPN/firewall. No publiques un servidor sin protección ni expongas `SUPABASE_SECRET_KEY` al navegador. Regenera cualquier clave que se haya compartido en capturas o mensajes.

## Verificaciones

`npm test` ejecuta las pruebas automáticas sin necesitar la base. La compilación completa (`npm.cmd run build`), la ejecución del SQL y el guardado real contra el proyecto Supabase deben verificarse en la computadora donde se instale.

## IMPORTANTE: IMEI

- No hay campo de correo en el alta del cliente. El identificador se captura como **IMEI en cada equipo**.
- Cliente: nombre, teléfono de contacto, domicilio, ciudad, CP y RFC.
- Equipo: descripción, marca, modelo, IMEI único de 15 dígitos, serie y precio.
- Si el cliente compra un segundo equipo, agrega el segundo IMEI al MISMO cliente.
- La búsqueda de clientes y órdenes permite pegar IMEI, nombre o teléfono.
- No borra registros ni PDFs de la versión anterior.
- Solo se muestra correo para **compartir PDFs por correo electrónico**; no es identificador de cliente.

Nota: no se aplicó el SQL en tu base en vivo desde aquí. Corre el instalador antes de usar la V5.
