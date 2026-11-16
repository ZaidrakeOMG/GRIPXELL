import {savePdf,pdfForId} from '../../lib/server/docs.mjs';
import {reply,fail,jsonBody,validUuid} from '../../lib/server/http.mjs';
export const prerender=false;
export async function GET({url}){
 try{
  const id=url.searchParams.get('id');if(!validUuid(id))throw new Error('PDF no encontrado');
  const {buffer,filename}=await pdfForId(id);
  return new Response(buffer,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}"`,'Content-Length':String(buffer.length),'Cache-Control':'no-store'}});
 }catch(e){return fail(e,404);}
}
export async function POST({request}){
 try{const b=await jsonBody(request);if(!validUuid(b.orden_id)||!['nota','estado_cuenta'].includes(b.tipo))throw new Error('Documento inválido');const doc=await savePdf(b.orden_id,b.tipo);return reply({ok:true,documento:doc});}catch(e){return fail(e,400);}
}
