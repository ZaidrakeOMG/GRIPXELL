-- ==============================================================
-- GRIPXELL V5 / IDENTIFICACION DE EQUIPOS POR IMEI (NO CORREO)
-- Compatible con clientes, ordenes, abonos y documentos anteriores.
-- NO BORRA NINGUN CLIENTE, EQUIPO, ORDEN NI PAGO.
-- ==============================================================
BEGIN;

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'activo';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fecha_baja timestamptz;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS motivo_baja text NOT NULL DEFAULT '';

-- El email que se pidio en la V4 era una confusion con el IMEI.
-- Si existe por una version anterior, CONSERVAMOS su valor historico,
-- pero se deja de usar y se quita su unicidad, sin borrar registros.
DROP INDEX IF EXISTS public.gripxell_clientes_email_unico;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='clientes' AND column_name='email') THEN
  ALTER TABLE public.clientes ALTER COLUMN email DROP NOT NULL;
 END IF;
END $$;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gripxell_cliente_estado_valido') THEN
  ALTER TABLE public.clientes ADD CONSTRAINT gripxell_cliente_estado_valido
    CHECK (estado IN ('activo','baja'));
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.dispositivos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
 descripcion text NOT NULL CHECK (length(btrim(descripcion)) > 0),
 marca text NOT NULL DEFAULT '', modelo text NOT NULL DEFAULT '', color text NOT NULL DEFAULT '',
 imei text NOT NULL DEFAULT '',
 numero_serie text NOT NULL DEFAULT '',
 precio_venta numeric(14,2) NOT NULL DEFAULT 0 CHECK(precio_venta >= 0),
 estado text NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo','baja')),
 fecha_registro timestamptz NOT NULL DEFAULT now(), fecha_baja timestamptz,
 observaciones text NOT NULL DEFAULT '',
 UNIQUE(id,cliente_id)
);
CREATE INDEX IF NOT EXISTS gripxell_dispositivos_cliente_ix
  ON public.dispositivos (cliente_id,fecha_registro DESC);
-- El IMEI pertenece al EQUIPO. Un mismo cliente puede tener VARIOS IMEI.
CREATE UNIQUE INDEX IF NOT EXISTS gripxell_dispositivos_imei_unico
  ON public.dispositivos (btrim(imei)) WHERE btrim(imei) <> '';

ALTER TABLE public.ordenes ADD COLUMN IF NOT EXISTS dispositivo_id uuid;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gripxell_orden_dispositivo_mismo_cliente') THEN
  ALTER TABLE public.ordenes ADD CONSTRAINT gripxell_orden_dispositivo_mismo_cliente
    FOREIGN KEY (dispositivo_id,cliente_id)
    REFERENCES public.dispositivos(id,cliente_id) ON DELETE RESTRICT;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS gripxell_orden_dispositivo_ix ON public.ordenes(dispositivo_id);

ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispositivos FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.dispositivos TO service_role;

CREATE OR REPLACE FUNCTION public.gripxell_no_borrar_cliente()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 RAISE EXCEPTION 'El cliente conserva su historial. Usa DAR DE BAJA en lugar de eliminarlo';
END $$;
DROP TRIGGER IF EXISTS trg_gripxell_no_borrar_cliente ON public.clientes;
CREATE TRIGGER trg_gripxell_no_borrar_cliente BEFORE DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.gripxell_no_borrar_cliente();
REVOKE ALL ON FUNCTION public.gripxell_no_borrar_cliente() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gripxell_no_borrar_cliente() TO service_role;

-- Retira solamente la firma antigua del procedimiento que pedía correo.
-- No elimina ninguna fila de la base de datos.
DROP FUNCTION IF EXISTS public.gripxell_crear_cliente_con_dispositivo(text,text,text,text,text,text,text,jsonb);

-- Cliente opcionalmente con primer telefono, en una transaccion.
-- Si se registra el telefono, su IMEI (15 digitos) es obligatorio.
CREATE OR REPLACE FUNCTION public.gripxell_crear_cliente_con_dispositivo(
 p_nombre text, p_telefono text, p_direccion text, p_ciudad text,
 p_codigo_postal text, p_rfc text, p_dispositivo jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid; v_desc text; v_imei text; v_precio numeric;
BEGIN
 IF length(btrim(coalesce(p_nombre,''))) < 2 THEN
  RAISE EXCEPTION 'Escribe el nombre del cliente';
 END IF;
 v_desc := btrim(coalesce(p_dispositivo->>'descripcion',''));
 v_imei := regexp_replace(btrim(coalesce(p_dispositivo->>'imei','')), '[[:space:]\-]', '', 'g');
 IF v_desc <> '' AND v_imei !~ '^[0-9]{15}$' THEN
  RAISE EXCEPTION 'El IMEI del telefono debe tener exactamente 15 digitos';
 END IF;
 IF v_desc = '' AND v_imei <> '' THEN
  RAISE EXCEPTION 'Para registrar un IMEI indica tambien el dispositivo';
 END IF;
 v_precio := coalesce(nullif(p_dispositivo->>'precio_venta','')::numeric,0);
 IF v_precio < 0 THEN RAISE EXCEPTION 'Precio de dispositivo invalido'; END IF;

 INSERT INTO public.clientes(nombre,telefono,direccion,ciudad,codigo_postal,rfc)
 VALUES (btrim(p_nombre),coalesce(p_telefono,''),coalesce(p_direccion,''),
         coalesce(p_ciudad,''),coalesce(p_codigo_postal,''),upper(coalesce(p_rfc,'')))
 RETURNING id INTO v_id;
 IF v_desc <> '' THEN
  INSERT INTO public.dispositivos(cliente_id,descripcion,marca,modelo,color,imei,numero_serie,precio_venta,observaciones)
  VALUES (v_id,v_desc,btrim(coalesce(p_dispositivo->>'marca','')),
          btrim(coalesce(p_dispositivo->>'modelo','')),
          btrim(coalesce(p_dispositivo->>'color','')),v_imei,
          btrim(coalesce(p_dispositivo->>'numero_serie','')),
          v_precio,btrim(coalesce(p_dispositivo->>'observaciones','')));
 END IF;
 RETURN v_id;
END $$;

-- Agregar otro IMEI al mismo cliente (sin crear otro cliente).
CREATE OR REPLACE FUNCTION public.gripxell_agregar_dispositivo(
 p_cliente_id uuid,p_descripcion text,p_marca text,p_modelo text,p_color text,
 p_imei text,p_numero_serie text,p_precio_venta numeric,p_observaciones text
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid; v_estado text; v_imei text;
BEGIN
 SELECT estado INTO v_estado FROM public.clientes WHERE id=p_cliente_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;
 IF v_estado <> 'activo' THEN RAISE EXCEPTION 'Reactiva el cliente antes de agregar dispositivos'; END IF;
 IF length(btrim(coalesce(p_descripcion,'')))=0 THEN RAISE EXCEPTION 'Indica el telefono o dispositivo'; END IF;
 IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN RAISE EXCEPTION 'Precio invalido'; END IF;
 v_imei := regexp_replace(btrim(coalesce(p_imei,'')), '[[:space:]\-]', '', 'g');
 IF v_imei !~ '^[0-9]{15}$' THEN RAISE EXCEPTION 'El IMEI debe tener exactamente 15 digitos'; END IF;
 INSERT INTO public.dispositivos(cliente_id,descripcion,marca,modelo,color,imei,numero_serie,precio_venta,observaciones)
 VALUES (p_cliente_id,btrim(p_descripcion),btrim(coalesce(p_marca,'')),btrim(coalesce(p_modelo,'')),
         btrim(coalesce(p_color,'')),v_imei,btrim(coalesce(p_numero_serie,'')),
         p_precio_venta,btrim(coalesce(p_observaciones,'')))
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.gripxell_crear_orden_con_dispositivo(
 p_cliente_id uuid,p_dispositivo_id uuid,p_fecha date,p_tipo_venta text,
 p_partidas jsonb,p_iva_porcentaje numeric,p_enganche numeric,
 p_abono_semanal numeric,p_observaciones text,p_folio bigint
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid; v_estado text;
BEGIN
 SELECT estado INTO v_estado FROM public.clientes WHERE id=p_cliente_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;
 IF v_estado <> 'activo' THEN RAISE EXCEPTION 'El cliente esta de baja. Reactivalo para nuevas ventas'; END IF;
 IF p_dispositivo_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.dispositivos WHERE id=p_dispositivo_id AND cliente_id=p_cliente_id AND estado='activo'
 ) THEN RAISE EXCEPTION 'El dispositivo no pertenece al cliente o esta de baja'; END IF;
 SELECT public.gripxell_crear_orden(p_cliente_id,p_fecha,p_tipo_venta,p_partidas,
     p_iva_porcentaje,p_enganche,p_abono_semanal,p_observaciones,p_folio) INTO v_id;
 UPDATE public.ordenes SET dispositivo_id=p_dispositivo_id WHERE id=v_id;
 RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.gripxell_crear_cliente_con_dispositivo(text,text,text,text,text,text,jsonb)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gripxell_agregar_dispositivo(uuid,text,text,text,text,text,text,numeric,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gripxell_crear_orden_con_dispositivo(uuid,uuid,date,text,jsonb,numeric,numeric,numeric,text,bigint)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gripxell_crear_cliente_con_dispositivo(text,text,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gripxell_agregar_dispositivo(uuid,text,text,text,text,text,text,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gripxell_crear_orden_con_dispositivo(uuid,uuid,date,text,jsonb,numeric,numeric,numeric,text,bigint) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
SELECT 'GRIPXELL V5: IMEI como identificador de equipo, sin requerir correo' AS resultado;
