import {getDb,check} from '../../lib/server/db.mjs';
import {BUCKET} from '../../lib/server/docs.mjs';
import {reply,fail,jsonBody,validUuid} from '../../lib/server/http.mjs';
export const prerender=false;
export async function POST({request}){
 try{
  const b=await jsonBody(request);if(!validUuid(b.id))throw new Error('Documento inválido');
  const db=getDb(),doc=check(await db.from('documentos').select('archivo_storage').eq('id',b.id).single(),'Documento');
  const result=check(await db.storage.from(BUCKET).createSignedUrl(doc.archivo_storage,86400),'Compartir PDF');
  return reply({ok:true,url:result.signedUrl,expira_en_horas:24});
 }catch(e){return fail(e,400);}
}
