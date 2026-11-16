import {getDb,check} from '../../lib/server/db.mjs';
import {savePdf} from '../../lib/server/docs.mjs';
import {reply,fail,jsonBody,txt,asDate,validUuid} from '../../lib/server/http.mjs';
export const prerender=false;
export async function POST({request}){
 try{
  const b=await jsonBody(request);if(!validUuid(b.orden_id))throw new Error('Orden inválida');
  const fecha=asDate(b.fecha),motivo=txt(b.motivo||'Semana sin pago',180);
  const ord=check(await getDb().from('ordenes').select('estado').eq('id',b.orden_id).single(),'Orden');
  if(ord.estado==='cancelada')throw new Error('Orden cancelada');
  check(await getDb().rpc('gripxell_registrar_sin_pago',{p_orden_id:b.orden_id,p_fecha:fecha,p_motivo:motivo}),'Registrar sin pago (ejecuta supabase/03_PAGOS_ATRASADOS.sql si falta la función)');
  let warning=null;try{await savePdf(b.orden_id,'estado_cuenta')}catch(e){warning=e.message}
  return reply({ok:true,warning});
 }catch(e){return fail(e,400);}
}
