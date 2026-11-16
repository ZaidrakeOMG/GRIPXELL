import {timingSafeEqual} from 'node:crypto';
import {getDb,check} from '../../lib/server/db.mjs';
import {reply,fail,jsonBody,validUuid} from '../../lib/server/http.mjs';

export const prerender=false;
const BUCKET='gripxell-documentos';

function codeMatches(given, expected) {
 const a=Buffer.from(String(given??'')),b=Buffer.from(String(expected??''));
 return b.length>=12 && a.length===b.length && timingSafeEqual(a,b);
}
export async function POST({request}) {
 try {
  const secret=(process.env.GRIPXELL_CODIGO_BORRADO||'').trim();
  if (secret.length<12) return fail(new Error('Eliminación deshabilitada: configura GRIPXELL_CODIGO_BORRADO (mínimo 12 caracteres) en Vercel > Settings > Environment Variables y vuelve a desplegar.'),403);
  const b=await jsonBody(request);
  if (!validUuid(b.cliente_id)||!['historial','cliente'].includes(b.modo)) throw Error('Selecciona cliente y tipo de eliminación');
  if (!codeMatches(b.codigo,secret)) return fail(new Error('Código de autorización incorrecto'),403);
  const db=getDb();
  const cliente=check(await db.from('clientes').select('id,nombre').eq('id',b.cliente_id).single(),'Cliente');
  const phrase=(b.modo==='cliente'?'BORRAR CLIENTE':'BORRAR HISTORIAL')+' '+cliente.nombre;
  if (b.confirmacion!==phrase) throw Error('La confirmación escrita no coincide');
  const rpc=await db.rpc('gripxell_eliminar_expediente',{p_cliente_id:cliente.id,p_modo:b.modo});
  if(rpc.error){
   if(['PGRST202','42883'].includes(rpc.error.code)||/could not find.*gripxell_eliminar_expediente/i.test(rpc.error.message||''))
    throw Error('Falta instalar la función de eliminación. Ejecuta supabase/05_ADMINISTRACION_ELIMINAR_CLIENTE.sql en SQL Editor del proyecto GRIPXELL y vuelve a intentarlo.');
   if(/no se pueden borrar (ordenes|clientes) directamente|conserva su historial/i.test(rpc.error.message||''))
    throw Error('Hay un trigger antiguo que impide borrar. Vuelve a ejecutar el SQL 05 después del instalador 00.');
  }
  const result=check(rpc,'Eliminar expediente');
  const paths=Array.isArray(result.rutas_pdf)?result.rutas_pdf.filter(Boolean):[];
  let removed=0,remaining=0;
  for(let i=0;i<paths.length;i+=100){
   const lot=paths.slice(i,i+100);
   const {error}=await db.storage.from(BUCKET).remove(lot);
   if(error)remaining+=lot.length;else removed+=lot.length;
  }
  return reply({ok:true,modo:result.modo,
   ordenes_eliminadas:result.ordenes_eliminadas,
   abonos_eliminados:result.abonos_eliminados,
   documentos_eliminados:result.documentos_eliminados,
   dispositivos_eliminados:result.dispositivos_eliminados,
   archivos_borrados:removed,archivos_pendientes:remaining,
   warning:remaining?'Expediente borrado de la base de datos, pero algunos PDF siguen en Storage. Revisa gripxell-documentos.':null});
 } catch(e){return fail(e,400);}
}
