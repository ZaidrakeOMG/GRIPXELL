import {normalizarImei} from '../../lib/cliente.mjs';
import {getDb,check} from '../../lib/server/db.mjs';
import {reply,fail,jsonBody,txt,decimal,validUuid} from '../../lib/server/http.mjs';
export const prerender=false;

function details(b){
 return {nombre:txt(b.nombre,180),telefono:txt(b.telefono,40),
         direccion:txt(b.direccion,250),ciudad:txt(b.ciudad,100),
         codigo_postal:txt(b.codigo_postal,15),rfc:txt(b.rfc,20).toUpperCase()};
}
function explain(error){
 if(error?.code==='23505' || error?.message?.includes('gripxell_dispositivos_imei_unico'))
  throw Error('Ese IMEI ya está registrado. Busca el cliente por IMEI y consulta su equipo.');
 throw error;
}
export async function POST({request}){
 try{
  const b=await jsonBody(request),client=details(b);
  if(!client.nombre)throw Error('Indica el nombre del cliente');
  const equipo=b.dispositivo||{};
  const imei=normalizarImei(equipo.imei,{obligatorio:!!String(equipo.descripcion||'').trim()});
  const device={descripcion:txt(equipo.descripcion,220),marca:txt(equipo.marca,90),modelo:txt(equipo.modelo,100),
   color:txt(equipo.color,60),imei,numero_serie:txt(equipo.numero_serie,80),
   precio_venta:decimal(equipo.precio_venta||0,'Precio del dispositivo'),observaciones:txt(equipo.observaciones,500)};
  const db=getDb();
  let id;
  try{id=check(await db.rpc('gripxell_crear_cliente_con_dispositivo',{
   p_nombre:client.nombre,p_telefono:client.telefono,p_direccion:client.direccion,
   p_ciudad:client.ciudad,p_codigo_postal:client.codigo_postal,p_rfc:client.rfc,p_dispositivo:device
  }),'Crear cliente y dispositivo')}catch(e){explain(e)}
  const cliente=check(await db.from('clientes').select('*').eq('id',id).single(),'Cliente creado');
  return reply({ok:true,cliente},201);
 }catch(e){return fail(e,400)}
}
export async function PUT({request}){
 try{
  const b=await jsonBody(request);if(!validUuid(b.id))throw Error('Cliente inválido');
  const changes=details(b);if(!changes.nombre)throw Error('Indica el nombre del cliente');
  const db=getDb();
  let cliente;
  try{cliente=check(await db.from('clientes').update(changes).eq('id',b.id).select('*').single(),'Actualizar cliente')}catch(e){explain(e)}
  return reply({ok:true,cliente});
 }catch(e){return fail(e,400)}
}
export async function PATCH({request}){
 try{
  const b=await jsonBody(request);if(!validUuid(b.id))throw Error('Cliente inválido');
  if(!['activo','baja'].includes(b.estado))throw Error('Estado de cliente inválido');
  const changes={estado:b.estado,fecha_baja:b.estado==='baja'?new Date().toISOString():null,
                 motivo_baja:b.estado==='baja'?txt(b.motivo,300):''};
  const cliente=check(await getDb().from('clientes').update(changes).eq('id',b.id).select('*').single(),'Cambiar estado de cliente');
  return reply({ok:true,cliente});
 }catch(e){return fail(e,400)}
}
