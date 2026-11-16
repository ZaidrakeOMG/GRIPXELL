import {getDb,check} from '../../lib/server/db.mjs';
import {normalizarImei} from '../../lib/cliente.mjs';
import {reply,fail,jsonBody,txt,decimal,validUuid} from '../../lib/server/http.mjs';
export const prerender=false;

export async function POST({request}){
 try{
  const b=await jsonBody(request);
  if(!validUuid(b.cliente_id))throw Error('Selecciona un cliente válido');
  if(!txt(b.descripcion,220))throw Error('Escribe el nombre del dispositivo');
  const db=getDb();
  let id;try{id=check(await db.rpc('gripxell_agregar_dispositivo',{
   p_cliente_id:b.cliente_id,p_descripcion:txt(b.descripcion,220),p_marca:txt(b.marca,90),
   p_modelo:txt(b.modelo,100),p_color:txt(b.color,60),p_imei:normalizarImei(b.imei,{obligatorio:true}),
   p_numero_serie:txt(b.numero_serie,80),p_precio_venta:decimal(b.precio_venta||0),
   p_observaciones:txt(b.observaciones,500)
  }),'Registrar dispositivo')}catch(e){if(e?.message?.includes('duplicate key')||e?.message?.includes('gripxell_dispositivos_imei_unico'))throw Error('Ese IMEI ya está registrado en otro equipo. Busca al cliente por IMEI.');throw e}
  const dispositivo=check(await db.from('dispositivos').select('*').eq('id',id).single(),'Dispositivo guardado');
  return reply({ok:true,dispositivo},201);
 }catch(e){return fail(e,400)}
}
export async function PATCH({request}){
 try{
  const b=await jsonBody(request);
  if(!validUuid(b.id))throw Error('Dispositivo inválido');
  if(!['activo','baja'].includes(b.estado))throw Error('Estado inválido');
  const changes={estado:b.estado,fecha_baja:b.estado==='baja'?new Date().toISOString():null};
  const dispositivo=check(await getDb().from('dispositivos').update(changes).eq('id',b.id).select('*').single(),'Actualizar dispositivo');
  return reply({ok:true,dispositivo});
 }catch(e){return fail(e,400)}
}
