-- GRIPXELL | 07_CORREGIR_ABONOS_Y_ENGANCHES.sql
-- Instalar en SQL Editor del proyecto GRIPXELL xddcspjdcrjonfowspcp
-- No elimina clientes, pagos ni historicos. Actualiza una funcion RPC.
BEGIN;
CREATE OR REPLACE FUNCTION public.gripxell_corregir_abono(
 p_abono_id uuid,
 p_fecha date,
 p_fecha_programada date,
 p_monto numeric,
 p_metodo text,
 p_referencia text,
 p_tipo text,
 p_motivo text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
 v_orden_id uuid;
 v_orden public.ordenes%ROWTYPE;
 v_anterior public.abonos%ROWTYPE;
 v_actual public.abonos%ROWTYPE;
 v_otros numeric(14,2);
 v_total_pagado numeric(14,2);
BEGIN
 IF current_user <> 'service_role' THEN
   RAISE EXCEPTION 'Operacion exclusiva del servidor';
 END IF;
 IF p_abono_id IS NULL THEN RAISE EXCEPTION 'Selecciona el pago'; END IF;
 IF p_fecha IS NULL THEN RAISE EXCEPTION 'Indica la fecha del pago'; END IF;
 IF p_monto IS NULL OR p_monto <= 0 OR p_monto > 999999999 THEN
   RAISE EXCEPTION 'El importe debe ser mayor que cero';
 END IF;
 IF p_metodo IS NULL OR p_metodo NOT IN ('efectivo','transferencia','tarjeta','otro') THEN
   RAISE EXCEPTION 'Forma de pago invalida';
 END IF;
 IF p_tipo IS NULL OR p_tipo NOT IN ('abono','enganche','liquidacion') THEN
   RAISE EXCEPTION 'Tipo de pago invalido';
 END IF;
 IF length(trim(coalesce(p_motivo,''))) < 4 THEN
   RAISE EXCEPTION 'Escribe un motivo de correccion de al menos 4 caracteres';
 END IF;

 -- Se bloquea primero la orden, igual que en el registro normal de abonos.
 SELECT orden_id INTO v_orden_id FROM public.abonos WHERE id=p_abono_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'El pago ya no existe'; END IF;
 SELECT * INTO v_orden FROM public.ordenes WHERE id=v_orden_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
 IF v_orden.estado='cancelada' THEN RAISE EXCEPTION 'La orden esta cancelada'; END IF;

 SELECT * INTO v_anterior FROM public.abonos WHERE id=p_abono_id FOR UPDATE;
 IF NOT FOUND OR v_anterior.orden_id <> v_orden_id THEN
   RAISE EXCEPTION 'Pago no encontrado o modificado durante la operacion';
 END IF;
 IF v_anterior.estado <> 'vigente' THEN
   RAISE EXCEPTION 'Un pago anulado no se puede editar; registra uno nuevo';
 END IF;

 SELECT coalesce(sum(a.monto),0) INTO v_otros
 FROM public.abonos a
 WHERE a.orden_id=v_orden_id AND a.estado='vigente' AND a.id<>p_abono_id;
 v_total_pagado := v_otros+round(p_monto,2);
 IF v_total_pagado>v_orden.total THEN
   RAISE EXCEPTION 'La suma de abonos supera el valor de la venta';
 END IF;
 IF v_orden.tipo_venta='contado' AND v_total_pagado < v_orden.total THEN
   RAISE EXCEPTION 'Una venta de contado no puede quedar con saldo pendiente';
 END IF;

 UPDATE public.abonos SET
   fecha_pago=p_fecha,
   fecha_programada=p_fecha_programada,
   monto=round(p_monto,2),
   metodo_pago=p_metodo,
   referencia=left(coalesce(p_referencia,''),250),
   tipo_pago=p_tipo
 WHERE id=p_abono_id
 RETURNING * INTO v_actual;

 -- Retirar SOLO la marca automatica derivada de la fecha anterior cuando
 -- ya no haya otro abono atrasado que la justifique. No toca marcas manuales.
 IF v_anterior.fecha_programada IS NOT NULL
    AND v_anterior.fecha_programada < v_anterior.fecha_pago
    AND NOT EXISTS(
      SELECT 1 FROM public.abonos a
      WHERE a.orden_id=v_orden_id AND a.estado='vigente'
        AND a.id<>p_abono_id
        AND a.fecha_programada=v_anterior.fecha_programada
        AND a.fecha_pago>v_anterior.fecha_programada
    )
 THEN
   DELETE FROM public.historial_movimientos h
   WHERE h.orden_id=v_orden_id AND h.tipo_movimiento='sin_pago'
     AND h.datos_nuevos->>'motivo'='No se pago el dia programado'
     AND h.datos_nuevos->>'fecha'=v_anterior.fecha_programada::text
     AND (
       h.datos_nuevos->>'abono_id'=p_abono_id::text
       OR h.datos_nuevos->>'fecha_pago_posterior'=v_anterior.fecha_pago::text
     );
 END IF;

 IF p_fecha_programada IS NOT NULL AND p_fecha_programada < p_fecha
    AND NOT EXISTS (
      SELECT 1 FROM public.historial_movimientos h
      WHERE h.orden_id=v_orden_id AND h.tipo_movimiento='sin_pago'
        AND h.datos_nuevos->>'fecha'=p_fecha_programada::text
    )
 THEN
   INSERT INTO public.historial_movimientos(orden_id,tipo_movimiento,descripcion,datos_nuevos)
   VALUES(v_orden_id,'sin_pago','Sin pago en la fecha acordada',
      jsonb_build_object('fecha',p_fecha_programada,'motivo','No se pago el dia programado',
      'fecha_pago_posterior',p_fecha,'abono_id',p_abono_id));
 END IF;

 UPDATE public.ordenes SET
   estado=CASE WHEN v_total_pagado>=v_orden.total THEN 'pagada' ELSE 'vigente' END,
   fecha_actualizacion=now()
 WHERE id=v_orden_id;

 -- La auditoria automatica tambien conserva el antes/despues del abono.
 INSERT INTO public.historial_movimientos(
   orden_id,tipo_movimiento,descripcion,datos_anteriores,datos_nuevos
 ) VALUES (
   v_orden_id,'correccion_abono',left(trim(p_motivo),500),
   to_jsonb(v_anterior),to_jsonb(v_actual)
 );
 RETURN v_orden_id;
END;
$$;
REVOKE ALL ON FUNCTION public.gripxell_corregir_abono(uuid,date,date,numeric,text,text,text,text)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gripxell_corregir_abono(uuid,date,date,numeric,text,text,text,text)
TO service_role;
COMMIT;
NOTIFY pgrst,'reload schema';
SELECT 'GRIPXELL: correccion de pagos instalada' AS resultado;
