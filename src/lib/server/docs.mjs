import { randomUUID } from 'node:crypto';
import { getDb, check, loadOrder, saldoDe } from './db.mjs';
import { createPdf, pdfName } from './pdf.mjs';
export const BUCKET='gripxell-documentos';
export async function savePdf(ordenId,tipo){
 if(!['nota','estado_cuenta'].includes(tipo))throw new Error('Tipo de PDF desconocido');
 const db=getDb(), data=await loadOrder(ordenId);
 const pdf=await createPdf(data,tipo), saldo=saldoDe(data.orden,data.abonos);
 const existing=check(await db.from('documentos').select('version').eq('orden_id',ordenId).eq('tipo_documento',tipo).order('version',{ascending:false}).limit(1),'Versiones');
 const version=(existing[0]?.version||0)+1;
 const path=`ordenes/${ordenId}/${tipo}/v${String(version).padStart(3,'0')}-${randomUUID()}.pdf`;
 check(await db.storage.from(BUCKET).upload(path,pdf,{contentType:'application/pdf',upsert:false,cacheControl:'3600'}),'Almacenamiento PDF');
 try {
  const record=check(await db.from('documentos').insert({orden_id:ordenId,tipo_documento:tipo,version,archivo_storage:path,total_guardado:saldo.total,abonado_guardado:saldo.abonado,saldo_guardado:saldo.saldo}).select('*').single(),'Historial PDF');
  return {...record,nombre:pdfName(data.orden,tipo)};
 }catch(e){await db.storage.from(BUCKET).remove([path]);throw e;}
}
export async function pdfForId(id){
 const db=getDb();const record=check(await db.from('documentos').select('*').eq('id',id).single(),'Documento');
 const ord=check(await db.from('ordenes').select('folio').eq('id',record.orden_id).single(),'Folio');
 const file=check(await db.storage.from(BUCKET).download(record.archivo_storage),'Archivo PDF');
 return {record,buffer:Buffer.from(await file.arrayBuffer()),filename:pdfName(ord,record.tipo_documento)};
}
