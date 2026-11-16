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

## Entrega: eliminar cliente o historial

Desde la pestaña **Administración** se puede elegir un cliente y eliminar:
- **Solo historial**: borra órdenes, abonos, bitácora y PDFs relacionados; conserva la ficha e IMEIs.
- **Cliente y expediente**: borra además dispositivos y datos personales.

Antes de usar esta función ejecuta `supabase/05_ADMINISTRACION_ELIMINAR_CLIENTE.sql` en SQL Editor del proyecto GRIPXELL. En Vercel configura la variable privada `GRIPXELL_CODIGO_BORRADO` con un valor aleatorio de al menos 12 caracteres. No es un inicio de sesión; solo se solicita cuando se elimina un expediente. Además se exige escribir exactamente el nombre del cliente para confirmar.

## Limpiar registros de prueba antes de entregar

Este procedimiento elimina **todos** los datos, incluidos los que puedan ser reales si están mezclados con pruebas. **No lo ejecutes en Party-book**.

1. En Supabase, proyecto `xddcspjdcrjonfowspcp`, abre Storage > `gripxell-documentos` y elimina los archivos de la carpeta `ordenes`.
2. En SQL Editor del mismo proyecto, ejecuta `supabase/06_LIMPIAR_PRUEBAS_SOLO_GRIPXELL.sql`.
3. Comprueba que los siete conteos del resultado sean cero. Se conservan tablas, funciones y el bucket. El folio autonumérico vuelve a empezar en 0017.

La importación del registro de prueba (folio 0016) está deshabilitada. No hay login en el sistema: antes de hacerlo público, protege el despliegue de Vercel. El código de eliminación no sustituye la protección de acceso de toda la aplicación. Rota la clave secreta de Supabase que se compartió anteriormente y cambia el repositorio de GitHub a privado.

## Precios con IVA y nueva captura de cliente

El detalle de las órdenes muestra **precio unitario e importe con IVA incluido** a partir del IVA ya almacenado en cada orden. No modifica ventas históricas, enganches, pagos ni saldos. Los PDFs que ya existían se conservan como versiones históricas; desde el detalle de orden, pulsa **Nuevo estado PDF** o **Nueva nota PDF** para generar una versión actualizada.

Si el botón de eliminación falla:

1. Ejecuta **supabase/05_ADMINISTRACION_ELIMINAR_CLIENTE.sql** en el SQL Editor del proyecto GRIPXELL **después** de instalar el SQL 00. No lo ejecutes en Party-book.
2. En **Vercel > Project > Settings > Environment Variables** crea **GRIPXELL_CODIGO_BORRADO** con un secreto de al menos 12 caracteres para el ambiente Production (y Preview si usas previsualizaciones). **Redeploy** para que la variable quede cargada. No subas el código a GitHub.
3. En **Administración**, busca al cliente, elige **Eliminar solo historial** si quieres conservar nombre/IMEI para repetir la venta o **Eliminar cliente y todo su expediente** para volverlo a capturar desde cero. Sigue la confirmación exacta, introduce el código y verifica que desapareció.
4. Si falla, lee el mensaje completo del diálogo de error: ahora distingue la función SQL faltante, el trigger antiguo y la variable de entorno sin configurar. **No ejecutes el SQL 06** para borrar un solo cliente: limpia toda la base.
