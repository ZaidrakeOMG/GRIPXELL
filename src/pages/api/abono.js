import {getDb,check} from '../../lib/server/db.mjs';
import {savePdf} from '../../lib/server/docs.mjs';
import {reply,fail,jsonBody,txt,asDate,decimal,validUuid} from '../../lib/server/http.mjs';
export const prerender=false;
export async function POST({request}){
 try{
  const b=await jsonBody(request);if(!validUuid(b.orden_id))throw new Error('Orden inválida');
  const id=check(await getDb().rpc('gripxell_registrar_abono_con_fecha',{p_orden_id:b.orden_id,p_fecha:asDate(b.fecha_pago),p_fecha_programada:b.fecha_programada?asDate(b.fecha_programada):null,p_monto:decimal(b.monto),p_metodo:txt(b.metodo_pago||'efectivo',40),p_referencia:txt(b.referencia,250),p_tipo:'abono'}),'Registrar abono (ejecuta supabase/03_PAGOS_ATRASADOS.sql si falta la función)');
  let warning=null;try{await savePdf(b.orden_id,'estado_cuenta')}catch(e){warning=`El abono se guardó; el PDF no pudo archivarse: ${e.message}`}
  return reply({ok:true,id,warning});
 }catch(e){return fail(e,400);}
}
export async function PATCH({request}){
 try{
  const b=await jsonBody(request);if(!validUuid(b.id))throw new Error('Abono inválido');
  const ordenId=check(await getDb().rpc('gripxell_anular_abono',{p_abono_id:b.id,p_motivo:txt(b.motivo,250)}),'Anular abono');
  let warning=null;try{await savePdf(ordenId,'estado_cuenta')}catch(e){warning=e.message}
  return reply({ok:true,orden_id:ordenId,warning});
 }catch(e){return fail(e,400);}
}
