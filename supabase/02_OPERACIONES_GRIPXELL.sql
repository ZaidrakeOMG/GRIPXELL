-- Ejecutar DESPUES de 01_TABLAS_GRIPXELL.sql
-- Operaciones atómicas desde Astro. No publicarlas a anon ni authenticated.

CREATE OR REPLACE FUNCTION public.gripxell_crear_orden(
 p_cliente_id uuid, p_fecha date, p_tipo_venta text, p_partidas jsonb,
 p_iva_porcentaje numeric DEFAULT 0, p_enganche numeric DEFAULT 0,
 p_abono_semanal numeric DEFAULT 0, p_observaciones text DEFAULT '',
 p_folio bigint DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
 v_orden uuid; v_subtotal numeric(14,2):=0; v_iva numeric(14,2); v_total numeric(14,2);
 v_item jsonb; v_cantidad numeric; v_precio numeric; v_descripcion text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=p_cliente_id) THEN
   RAISE EXCEPTION 'Cliente no encontrado';
 END IF;
 IF p_tipo_venta NOT IN ('contado','credito') OR p_tipo_venta IS NULL THEN
   RAISE EXCEPTION 'Tipo de venta invalido';
 END IF;
 IF jsonb_typeof(p_partidas) <> 'array' OR jsonb_array_length(p_partidas) NOT BETWEEN 1 AND 40 THEN
   RAISE EXCEPTION 'Se requieren de 1 a 40 productos';
 END IF;
 IF p_iva_porcentaje IS NULL OR p_iva_porcentaje NOT BETWEEN 0 AND 100 THEN
   RAISE EXCEPTION 'IVA invalido';
 END IF;
 IF p_enganche IS NULL OR p_enganche < 0 OR p_abono_semanal IS NULL OR p_abono_semanal < 0 THEN
   RAISE EXCEPTION 'Enganche o abono semanal invalido';
 END IF;
 FOR v_item IN SELECT * FROM jsonb_array_elements(p_partidas) LOOP
   v_cantidad := (v_item->>'cantidad')::numeric;
   v_precio := (v_item->>'precio_unitario')::numeric;
   v_descripcion := trim(v_item->>'descripcion');
   IF v_cantidad<=0 OR v_precio<0 OR v_descripcion IS NULL OR length(v_descripcion)=0 THEN
     RAISE EXCEPTION 'Partida invalida';
   END IF;
   v_subtotal:=v_subtotal+round(v_cantidad*v_precio,2);
 END LOOP;
 v_iva:=round(v_subtotal*p_iva_porcentaje/100,2);
 v_total:=v_subtotal+v_iva;
 IF p_enganche>v_total THEN RAISE EXCEPTION 'El enganche excede el total'; END IF;
 IF p_tipo_venta='contado' AND p_abono_semanal>0 THEN RAISE EXCEPTION 'Contado no requiere abono semanal'; END IF;
 IF p_folio IS NOT NULL AND p_folio<=0 THEN RAISE EXCEPTION 'Folio invalido'; END IF;

 IF p_folio IS NULL THEN
  INSERT INTO public.ordenes(cliente_id,fecha,tipo_venta,subtotal,iva,total,enganche,abono_semanal,observaciones,estado)
  VALUES(p_cliente_id,coalesce(p_fecha,current_date),p_tipo_venta,v_subtotal,v_iva,v_total,p_enganche,p_abono_semanal,coalesce(p_observaciones,''),
   CASE WHEN v_total=0 THEN 'pagada' ELSE 'vigente' END) RETURNING id INTO v_orden;
 ELSE
  INSERT INTO public.ordenes(cliente_id,folio,fecha,tipo_venta,subtotal,iva,total,enganche,abono_semanal,observaciones,estado)
  VALUES(p_cliente_id,p_folio,coalesce(p_fecha,current_date),p_tipo_venta,v_subtotal,v_iva,v_total,p_enganche,p_abono_semanal,coalesce(p_observaciones,''),
   CASE WHEN v_total=0 THEN 'pagada' ELSE 'vigente' END) RETURNING id INTO v_orden;
 END IF;
 FOR v_item IN SELECT * FROM jsonb_array_elements(p_partidas) LOOP
  INSERT INTO public.orden_detalles(orden_id,cantidad,descripcion,precio_unitario)
  VALUES(v_orden,(v_item->>'cantidad')::numeric,trim(v_item->>'descripcion'),(v_item->>'precio_unitario')::numeric);
 END LOOP;
 -- El enganche pactado se registra como pago REAL una sola vez.
 IF p_enganche>0 THEN
  INSERT INTO public.abonos(orden_id,fecha_pago,monto,tipo_pago,metodo_pago,referencia)
  VALUES(v_orden,coalesce(p_fecha,current_date),p_enganche,'enganche','efectivo','Enganche inicial');
 END IF;
 IF p_tipo_venta='contado' AND v_total>p_enganche THEN
  -- Contado se considera pagado en la fecha de emision.
  INSERT INTO public.abonos(orden_id,fecha_pago,monto,tipo_pago,metodo_pago,referencia)
  VALUES(v_orden,coalesce(p_fecha,current_date),v_total-p_enganche,'liquidacion','efectivo','Venta de contado');
 END IF;
 IF p_tipo_venta='contado' OR v_total=p_enganche THEN
  UPDATE public.ordenes SET estado='pagada',fecha_actualizacion=now() WHERE id=v_orden;
 END IF;
 RETURN v_orden;
END $$;

CREATE OR REPLACE FUNCTION public.gripxell_registrar_abono(
 p_orden_id uuid, p_fecha date, p_monto numeric,
 p_metodo text DEFAULT 'efectivo', p_referencia text DEFAULT '',p_tipo text DEFAULT 'abono'
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_total numeric; v_pagado numeric; v_estado text; v_id uuid;
BEGIN
 IF p_monto IS NULL OR p_monto<=0 THEN RAISE EXCEPTION 'Monto invalido'; END IF;
 IF p_metodo NOT IN('efectivo','transferencia','tarjeta','otro') OR p_tipo NOT IN('abono','liquidacion','enganche') THEN
  RAISE EXCEPTION 'Metodo o tipo de abono invalido';
 END IF;
 SELECT total,estado INTO v_total,v_estado FROM public.ordenes WHERE id=p_orden_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Orden inexistente'; END IF;
 IF v_estado='cancelada' THEN RAISE EXCEPTION 'No se pueden abonar ordenes canceladas'; END IF;
 SELECT coalesce(sum(monto),0) INTO v_pagado FROM public.abonos WHERE orden_id=p_orden_id AND estado='vigente';
 IF v_pagado+p_monto>v_total THEN RAISE EXCEPTION 'El abono excede el saldo pendiente'; END IF;
 INSERT INTO public.abonos(orden_id,fecha_pago,monto,metodo_pago,referencia,tipo_pago)
 VALUES(p_orden_id,coalesce(p_fecha,current_date),p_monto,p_metodo,coalesce(p_referencia,''),p_tipo)
 RETURNING id INTO v_id;
 IF v_pagado+p_monto>=v_total THEN
  UPDATE public.ordenes SET estado='pagada',fecha_actualizacion=now() WHERE id=p_orden_id;
 END IF;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.gripxell_anular_abono(p_abono_id uuid,p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_orden uuid; v_estado text;
BEGIN
 IF length(trim(coalesce(p_motivo,'')))<4 THEN RAISE EXCEPTION 'Indica el motivo de anulacion'; END IF;
 SELECT orden_id INTO v_orden FROM public.abonos WHERE id=p_abono_id;
 IF v_orden IS NULL THEN RAISE EXCEPTION 'Abono no encontrado'; END IF;
 SELECT estado INTO v_estado FROM public.ordenes WHERE id=v_orden FOR UPDATE;
 UPDATE public.abonos SET estado='anulado',motivo_anulacion=trim(p_motivo)
 WHERE id=p_abono_id AND estado='vigente';
 IF NOT FOUND THEN RAISE EXCEPTION 'El abono ya estaba anulado'; END IF;
 IF v_estado<>'cancelada' THEN
  UPDATE public.ordenes SET estado='vigente',fecha_actualizacion=now() WHERE id=v_orden;
 END IF;
 RETURN v_orden;
END $$;

REVOKE ALL ON FUNCTION public.gripxell_crear_orden(uuid,date,text,jsonb,numeric,numeric,numeric,text,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gripxell_registrar_abono(uuid,date,numeric,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gripxell_anular_abono(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gripxell_crear_orden(uuid,date,text,jsonb,numeric,numeric,numeric,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.gripxell_registrar_abono(uuid,date,numeric,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gripxell_anular_abono(uuid,text) TO service_role;
SELECT 'GRIPXELL: operaciones atomicas listas' AS resultado;
