import {readFile} from 'node:fs/promises';
import {getDb,check} from '../../lib/server/db.mjs';
import {savePdf} from '../../lib/server/docs.mjs';
import {reply,fail,jsonBody} from '../../lib/server/http.mjs';
export const prerender=false;
export async function POST({request}){
 try{
  const b=await jsonBody(request);if(b.confirmar!=='IMPORTAR_0016')throw new Error('Confirmación incorrecta');
  const db=getDb();const existing=check(await db.from('ordenes').select('id').eq('folio',16).maybeSingle(),'Buscar folio');
  if(existing)return reply({ok:false,error:'El folio N°000016 ya existe. No se importó dos veces.'},409);
  const data=JSON.parse(await readFile(new URL('../../../datos/registro_excel.json',import.meta.url),'utf8'));
  const c=check(await db.from('clientes').insert(data.cliente).select('id').single(),'Importar cliente');
  const args={p_cliente_id:c.id,p_fecha:data.venta.fecha,p_tipo_venta:data.venta.modalidad,p_partidas:data.partidas,p_iva_porcentaje:data.venta.tasa_iva,p_enganche:data.venta.enganche,p_abono_semanal:data.venta.abono_semanal,p_observaciones:'Importación del archivo MACHO.xlsx; Hoja2; N°0016',p_folio:16};
  const id=check(await db.rpc('gripxell_crear_orden',args),'Importar orden');
  for(const a of data.abonos){check(await db.rpc('gripxell_registrar_abono',{p_orden_id:id,p_fecha:a.fecha,p_monto:a.monto,p_metodo:a.metodo,p_referencia:a.comentario,p_tipo:a.tipo}),'Importar abono');}
  const warnings=[];for(const t of ['nota','estado_cuenta'])try{await savePdf(id,t);}catch(e){warnings.push(e.message)}
  return reply({ok:true,id,warnings});
 }catch(e){return fail(e,400);}
}
