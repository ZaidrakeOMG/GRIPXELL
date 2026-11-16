import {zipSync} from 'fflate';
import {getDb,check} from '../../lib/server/db.mjs';
import {BUCKET} from '../../lib/server/docs.mjs';
import {pdfName} from '../../lib/server/pdf.mjs';
import {fail} from '../../lib/server/http.mjs';
export const prerender=false;
async function allPages(db,table,cols,sort){
 const result=[];const pageSize=1000;
 for(let offset=0;;offset+=pageSize){
  const data=check(await db.from(table).select(cols).order(sort,{ascending:false}).range(offset,offset+pageSize-1),table);
  result.push(...data);if(data.length<pageSize)break;
 }
 return result;
}
export async function GET(){
 try{
  const db=getDb();
  const [docs,orders]=await Promise.all([
   allPages(db,'documentos','*','fecha_generacion'),
   allPages(db,'ordenes','id,folio','folio')
  ]);
  const byId=new Map(orders.map(o=>[o.id,o]));const seen=new Set();const files={};let total=0;
  for(const d of docs){
   const key=d.orden_id+':'+d.tipo_documento;
   if(seen.has(key))continue;
   seen.add(key);
   const ord=byId.get(d.orden_id);if(!ord)throw Error('Documento sin orden asociada');
   const pdf=check(await db.storage.from(BUCKET).download(d.archivo_storage),'Descargar PDF');
   files[pdfName(ord,d.tipo_documento)]=new Uint8Array(await pdf.arrayBuffer());
   total++;
  }
  if(!total)throw Error('Todavía no hay PDFs guardados');
  // En carteras muy grandes el ZIP puede consumir memoria: no se cortan registros silenciosamente.
  const bytes=zipSync(files,{level:3});
  return new Response(bytes,{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="GRIPXELL_REPORTES.zip"','Cache-Control':'no-store'}});
 }catch(e){return fail(e,400)}
}
