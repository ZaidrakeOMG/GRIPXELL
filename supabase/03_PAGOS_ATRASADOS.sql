-- ===========================================================
-- GRIPXELL - ACTUALIZACION PARA PAGOS FUERA DE FECHA
-- Ejecutar en SQL Editor del proyecto GRIPXELL ACTUAL.
-- No borra clientes, ordenes, pagos ni documentos existentes.
-- Requiere 01_TABLAS_GRIPXELL.sql y 02_OPERACIONES_GRIPXELL.sql.
-- ===========================================================

BEGIN;

ALTER TABLE public.abonos
  ADD COLUMN IF NOT EXISTS fecha_programada date;

COMMENT ON COLUMN public.abonos.fecha_programada IS
  'Fecha en que correspondia realizar el pago; fecha_pago es la fecha real.';

-- Registra un abono con fecha comprometida y fecha real de pago.
-- Si el dinero se entrego despues, archiva el SIN PAGO del dia acordado.
CREATE OR REPLACE FUNCTION public.gripxell_registrar_abono_con_fecha(
  p_orden_id uuid,
  p_fecha date,
  p_fecha_programada date,
  p_monto numeric,
  p_metodo text,
  p_referencia text,
  p_tipo text DEFAULT 'abono'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_total numeric(14,2);
  v_pagado numeric(14,2);
  v_estado text;
  v_abono uuid;
BEGIN
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'Indica la fecha real de pago';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El abono debe ser mayor a cero';
  END IF;
  IF p_metodo IS NULL OR p_metodo NOT IN ('efectivo','transferencia','tarjeta','otro')
     OR p_tipo IS NULL OR p_tipo NOT IN ('abono','enganche','liquidacion') THEN
    RAISE EXCEPTION 'Metodo o tipo de pago invalido';
  END IF;
  SELECT total, estado INTO v_total, v_estado
  FROM public.ordenes WHERE id = p_orden_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;
  IF v_estado = 'cancelada' THEN
    RAISE EXCEPTION 'La orden esta cancelada';
  END IF;
  SELECT COALESCE(SUM(monto),0) INTO v_pagado
  FROM public.abonos WHERE orden_id=p_orden_id AND estado='vigente';
  IF v_pagado + p_monto > v_total THEN
    RAISE EXCEPTION 'El pago excede el saldo pendiente';
  END IF;

  IF p_fecha_programada IS NOT NULL AND p_fecha_programada < p_fecha
     AND NOT EXISTS (
       SELECT 1 FROM public.historial_movimientos
       WHERE orden_id=p_orden_id AND tipo_movimiento='sin_pago'
         AND datos_nuevos->>'fecha'=p_fecha_programada::text
     ) THEN
      INSERT INTO public.historial_movimientos(
        orden_id, tipo_movimiento, descripcion, datos_nuevos
      ) VALUES (
        p_orden_id, 'sin_pago', 'Sin pago en la fecha acordada',
        jsonb_build_object(
          'fecha',p_fecha_programada,
          'motivo','No se pago el dia programado',
          'fecha_pago_posterior',p_fecha
        )
      );
  END IF;

  INSERT INTO public.abonos(
    orden_id, fecha_pago, fecha_programada, monto, tipo_pago,
    metodo_pago, referencia
  ) VALUES (
    p_orden_id, p_fecha, p_fecha_programada, p_monto, p_tipo,
    p_metodo, COALESCE(p_referencia,'')
  ) RETURNING id INTO v_abono;

  IF v_pagado + p_monto >= v_total THEN
    UPDATE public.ordenes
    SET estado='pagada', fecha_actualizacion=now()
    WHERE id=p_orden_id;
  END IF;
  RETURN v_abono;
END;
$$;

-- Permite registrar la fecha SIN PAGO aunque todavia no haya abonado.
-- La fecha queda en el historial, no genera cargos ni reduce el saldo.
CREATE OR REPLACE FUNCTION public.gripxell_registrar_sin_pago(
  p_orden_id uuid,
  p_fecha date,
  p_motivo text DEFAULT 'Sin pago en fecha programada'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_estado text;
  v_evento uuid;
BEGIN
  IF p_fecha IS NULL THEN RAISE EXCEPTION 'Indica la fecha sin pago'; END IF;
  SELECT estado INTO v_estado FROM public.ordenes
  WHERE id=p_orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF v_estado='cancelada' THEN RAISE EXCEPTION 'La orden esta cancelada'; END IF;

  SELECT id INTO v_evento FROM public.historial_movimientos
  WHERE orden_id=p_orden_id AND tipo_movimiento='sin_pago'
    AND datos_nuevos->>'fecha'=p_fecha::text
  ORDER BY fecha_movimiento LIMIT 1;
  IF v_evento IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe un registro SIN PAGO para esta fecha';
  END IF;

  INSERT INTO public.historial_movimientos(
    orden_id,tipo_movimiento,descripcion,datos_nuevos
  ) VALUES (
    p_orden_id,'sin_pago',COALESCE(NULLIF(TRIM(p_motivo),''),'Sin pago en fecha programada'),
    jsonb_build_object('fecha',p_fecha,'motivo',COALESCE(p_motivo,''))
  ) RETURNING id INTO v_evento;
  RETURN v_evento;
END;
$$;

REVOKE ALL ON FUNCTION public.gripxell_registrar_abono_con_fecha(uuid,date,date,numeric,text,text,text)
FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gripxell_registrar_sin_pago(uuid,date,text)
FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.gripxell_registrar_abono_con_fecha(uuid,date,date,numeric,text,text,text)
TO service_role;
GRANT EXECUTE ON FUNCTION public.gripxell_registrar_sin_pago(uuid,date,text)
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.abonos,public.historial_movimientos
TO service_role;

COMMIT;

-- Actualiza los procedimientos RPC reconocidos por la API de Supabase.
NOTIFY pgrst, 'reload schema';

SELECT 'GRIPXELL: fechas programadas y pagos tardios listos' AS resultado;
