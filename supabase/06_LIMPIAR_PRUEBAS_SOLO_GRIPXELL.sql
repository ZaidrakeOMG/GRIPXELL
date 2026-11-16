-- ATENCION: ELIMINA PERMANENTEMENT TODOS LOS REGISTROS DE GRIPXELL.
-- Ejecuta SOLO en https://supabase.com/dashboard/project/xddcspjdcrjonfowspcp/sql/new
-- Antes limpia los PDF de Storage con: npm.cmd run limpiar:pdfs -- --confirmar=SI_BORRAR_PDFS
-- No elimina tablas, funciones, bucket ni RLS. Tampoco afecta Party-book.
-- Si hay datos reales mezclados con pruebas, tambien se perderan.
BEGIN;
TRUNCATE TABLE public.historial_movimientos,public.documentos,public.abonos,
public.orden_detalles,public.ordenes,public.dispositivos,public.clientes
RESTART IDENTITY;
COMMIT;
SELECT 'clientes' tabla,count(*) registros FROM public.clientes
UNION ALL SELECT 'dispositivos',count(*) FROM public.dispositivos
UNION ALL SELECT 'ordenes',count(*) FROM public.ordenes
UNION ALL SELECT 'abonos',count(*) FROM public.abonos
UNION ALL SELECT 'documentos',count(*) FROM public.documentos
UNION ALL SELECT 'historial_movimientos',count(*) FROM public.historial_movimientos;
