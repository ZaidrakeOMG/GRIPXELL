import {getDb,check} from '../../lib/server/db.mjs';
import {reply,fail} from '../../lib/server/http.mjs';
export const prerender=false;
async function listAll(db,table,cols,field,ascending=true){
 const arr=[];const pageSize=1000;
 for(let from=0;;from+=pageSize){
  const page=check(await db.from(table).select(cols).order(field,{ascending}).range(from,from+pageSize-1),table);
  arr.push(...page);if(page.length<pageSize)break;
 }
 return arr;
}
export async function GET(){
 try{
  const db=getDb();const [clientes,ordenes,documentos,abonos,dispositivos]=await Promise.all([
   listAll(db,'clientes','*','nombre'),
   listAll(db,'ordenes','*','folio',false),
   listAll(db,'documentos','id,orden_id,tipo_documento,version,fecha_generacion','fecha_generacion',false),
   listAll(db,'abonos','id,orden_id,monto,estado,fecha_pago,fecha_programada,tipo_pago,metodo_pago,referencia','fecha_pago',false),
   listAll(db,'dispositivos','*','fecha_registro',false)
  ]);
  return reply({ok:true,clientes,ordenes,documentos,abonos,dispositivos});
 }catch(e){return fail(e)}
}
