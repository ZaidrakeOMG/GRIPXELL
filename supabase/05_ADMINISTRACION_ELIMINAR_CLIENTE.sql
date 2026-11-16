-- GRIPXELL ADMINISTRACION: NO BORRA DATOS AL INSTALAR ESTA MIGRACION.
-- Ejecutar en el proyecto xddcspjdcrjonfowspcp.
BEGIN;
CREATE OR REPLACE FUNCTION public.gripxell_no_borrar_orden()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user='service_role'
    AND current_setting('gripxell.purga_cliente',true)=OLD.cliente_id::text
 THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'No se pueden borrar ordenes directamente';
END $$;

CREATE OR REPLACE FUNCTION public.gripxell_no_borrar_cliente()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user='service_role'
    AND current_setting('gripxell.purga_cliente',true)=OLD.id::text
 THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'No se pueden borrar clientes directamente';
END $$;

-- Elimina solo el historial o el expediente del cliente dentro de una transaccion.
-- Los PDFs fisicos se eliminan de Storage desde Astro tras confirmar la RPC.
CREATE OR REPLACE FUNCTION public.gripxell_eliminar_expediente(
 p_cliente_id uuid,p_modo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_ordenes integer;v_abonos integer;v_documentos integer;v_dispositivos integer;v_archivos jsonb;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF p_modo IS NULL OR p_modo NOT IN ('historial','cliente') THEN RAISE EXCEPTION 'Modo invalido'; END IF;
 PERFORM 1 FROM public.clientes WHERE id=p_cliente_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;
 SELECT count(*) INTO v_ordenes FROM public.ordenes WHERE cliente_id=p_cliente_id;
 SELECT count(*) INTO v_abonos FROM public.abonos a JOIN public.ordenes o ON a.orden_id=o.id WHERE o.cliente_id=p_cliente_id;
 SELECT count(*) INTO v_documentos FROM public.documentos d JOIN public.ordenes o ON d.orden_id=o.id WHERE o.cliente_id=p_cliente_id;
 SELECT count(*) INTO v_dispositivos FROM public.dispositivos WHERE cliente_id=p_cliente_id;
 SELECT coalesce(jsonb_agg(d.archivo_storage),'[]'::jsonb) INTO v_archivos FROM public.documentos d JOIN public.ordenes o ON d.orden_id=o.id WHERE o.cliente_id=p_cliente_id;
 PERFORM set_config('gripxell.purga_cliente',p_cliente_id::text,true);
 DELETE FROM public.documentos d USING public.ordenes o WHERE d.orden_id=o.id AND o.cliente_id=p_cliente_id;
 DELETE FROM public.abonos a USING public.ordenes o WHERE a.orden_id=o.id AND o.cliente_id=p_cliente_id;
 DELETE FROM public.orden_detalles x USING public.ordenes o WHERE x.orden_id=o.id AND o.cliente_id=p_cliente_id;
 -- Triggers de borrado de pagos y partidas pueden crear movimientos: limpiar despues.
 DELETE FROM public.historial_movimientos h USING public.ordenes o WHERE h.orden_id=o.id AND o.cliente_id=p_cliente_id;
 DELETE FROM public.ordenes WHERE cliente_id=p_cliente_id;
 IF p_modo='cliente' THEN
  DELETE FROM public.dispositivos WHERE cliente_id=p_cliente_id;
  DELETE FROM public.clientes WHERE id=p_cliente_id;
 END IF;
 RETURN jsonb_build_object('modo',p_modo,'ordenes_eliminadas',v_ordenes,'abonos_eliminados',v_abonos,
   'documentos_eliminados',v_documentos,'dispositivos_eliminados',CASE WHEN p_modo='cliente' THEN v_dispositivos ELSE 0 END,
   'rutas_pdf',v_archivos);
END $$;
REVOKE ALL ON FUNCTION public.gripxell_eliminar_expediente(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gripxell_eliminar_expediente(uuid,text) TO service_role;
COMMIT;
NOTIFY pgrst,'reload schema';
