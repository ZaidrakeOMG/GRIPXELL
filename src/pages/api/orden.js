import {getDb,check,loadOrder} from '../../lib/server/db.mjs';
import {validarEdicionExpediente} from '../../lib/expediente.mjs';
import {savePdf} from '../../lib/server/docs.mjs';
import {reply,fail,jsonBody,txt,decimal,asDate,validUuid} from '../../lib/server/http.mjs';
export const prerender=false;
export async function GET({url}){
 try{const id=url.searchParams.get('id');if(!validUuid(id))throw new Error('ID de orden inválido');return reply({ok:true,...await loadOrder(id)});}catch(e){return fail(e,400);}
}
export async function POST({request}){
 try{
  const b=await jsonBody(request);
  if(!validUuid(b.cliente_id))throw new Error('Selecciona un cliente');
  if(!Array.isArray(b.partidas)||b.partidas.length<1||b.partidas.length>40)throw new Error('Agrega de 1 a 40 productos');
  const parts=b.partidas.map(p=>({descripcion:txt(p.descripcion,250),cantidad:Number(p.cantidad),precio_unitario:decimal(p.precio_unitario,'Precio')}));
  if(parts.some(p=>!p.descripcion||!Number.isFinite(p.cantidad)||p.cantidad<=0||p.cantidad>100000))throw new Error('Revisa las partidas');
  if(b.dispositivo_id && !validUuid(b.dispositivo_id))throw new Error('Dispositivo inválido');
  const args={p_cliente_id:b.cliente_id,p_fecha:asDate(b.fecha),p_tipo_venta:['credito','contado'].includes(b.tipo_venta)?b.tipo_venta:'credito',p_partidas:parts,p_iva_porcentaje:decimal(b.iva_porcentaje||0,'IVA'),p_enganche:decimal(b.enganche||0,'Enganche'),p_abono_semanal:decimal(b.abono_semanal||0,'Abono semanal'),p_observaciones:txt(b.observaciones,1000),p_folio:null,p_dispositivo_id:b.dispositivo_id||null};
  const id=check(await getDb().rpc('gripxell_crear_orden_con_dispositivo',args),'Guardar orden vinculada a dispositivo');
  const warnings=[]; const documentos=[];
  for(const tipo of ['nota','estado_cuenta'])try{documentos.push(await savePdf(id,tipo));}catch(e){warnings.push(`No se guardó ${tipo}: ${e.message}`);}
  return reply({ok:true,id,documentos,warnings},201);
 }catch(e){return fail(e,400);}
}
export async function PATCH({request}){
 try{
  const b=await jsonBody(request);if(!validUuid(b.id))throw new Error('ID inválido');
  if(b.accion==='actualizar_expediente'){
    // Solo datos identificativos: no modifica el total, folio, enganche ni abonos.
    const db=getDb();
    const anterior=check(await db.from('ordenes').select('id,cliente_id,dispositivo_id,estado').eq('id',b.id).single(),'Orden');
    const cliente=check(await db.from('clientes').select('id,rfc').eq('id',anterior.cliente_id).single(),'Cliente');
    const dispositivoId=b.dispositivo_id==null||b.dispositivo_id===''?null:b.dispositivo_id;
    if(dispositivoId!==null && !validUuid(dispositivoId))throw Error('Selecciona un dispositivo válido');
    const equipo=dispositivoId?check(await db.from('dispositivos').select('id,cliente_id,estado').eq('id',dispositivoId).maybeSingle(),'Dispositivo'):null;
    const cambio=validarEdicionExpediente(anterior,cliente,equipo,dispositivoId,b.rfc);
    if(!cambio.editaRfc&&!cambio.editaDispositivo)return reply({ok:true,sin_cambios:true,warnings:[]});
    if(cambio.editaDispositivo){
      let q=db.from('ordenes').update({dispositivo_id:cambio.dispositivo_id,fecha_actualizacion:new Date().toISOString()})
       .eq('id',anterior.id).eq('estado',anterior.estado);
      q=anterior.dispositivo_id?q.eq('dispositivo_id',anterior.dispositivo_id):q.is('dispositivo_id',null);
      const guardada=check(await q.select('id').maybeSingle(),'Vincular equipo');
      if(!guardada)throw Error('La orden cambió durante la edición; vuelve a abrirla');
    }
    if(cambio.editaRfc){
      try{
        check(await db.from('clientes').update({rfc:cambio.rfc}).eq('id',cliente.id).select('id').single(),'Actualizar RFC');
      }catch(err){
        if(cambio.editaDispositivo){
          try{
            let q=db.from('ordenes').update({dispositivo_id:anterior.dispositivo_id}).eq('id',anterior.id);
            q=cambio.dispositivo_id?q.eq('dispositivo_id',cambio.dispositivo_id):q.is('dispositivo_id',null);
            check(await q.select('id').maybeSingle(),'Restaurar vínculo');
          }catch{}
        }
        throw Error('No se pudo guardar el RFC. Reabre el expediente antes de reintentar: '+err.message);
      }
    }
    const warnings=[];
    try{
      check(await db.from('historial_movimientos').insert({
        orden_id:anterior.id,tipo_movimiento:'correccion_expediente',
        descripcion:'Actualización de RFC y dispositivo asociado',
        datos_anteriores:{rfc:cliente.rfc,dispositivo_id:anterior.dispositivo_id},
        datos_nuevos:{rfc:cambio.rfc,dispositivo_id:cambio.dispositivo_id}
      }),'Bitácora del expediente');
    }catch(err){warnings.push('Bitácora: '+err.message);}
    for(const tipo of ['nota','estado_cuenta']){
      try{await savePdf(anterior.id,tipo);}
      catch(err){warnings.push('PDF '+tipo+': '+err.message);}
    }
    return reply({ok:true,warnings});
  }
  if (b.accion==='actualizar_condiciones') {
    const db=getDb();
    const actual=check(await db.from('ordenes').select('id,total,estado,tipo_venta').eq('id',b.id).single(),'Orden');
    if(actual.estado==='cancelada')throw new Error('No se pueden cambiar condiciones de una orden cancelada');
    const enganche=decimal(b.enganche,'Enganche acordado');
    const abono_semanal=decimal(b.abono_semanal,'Abono semanal');
    if(enganche>Number(actual.total))throw new Error('El enganche no puede superar el total de la venta');
    if(actual.tipo_venta==='contado'&&abono_semanal!==0)throw new Error('Una venta de contado no requiere abono semanal');
    const orden=check(await db.from('ordenes').update({
      enganche,abono_semanal,fecha_actualizacion:new Date().toISOString()
    }).eq('id',b.id).eq('estado',actual.estado).select('*').single(),'Guardar condiciones');
    const warnings=[];
    for(const tipo of ['nota','estado_cuenta']) {
      try {await savePdf(b.id,tipo);}
      catch(e){warnings.push(`No se pudo archivar PDF ${tipo}: ${e.message}`);}
    }
    return reply({ok:true,orden,warnings});
  }
  if(b.estado!=='cancelada')throw new Error('Solo se permite cancelar');
  const data=check(await getDb().from('ordenes').update({estado:'cancelada',fecha_actualizacion:new Date().toISOString()}).eq('id',b.id).select('id').single(),'Cancelar orden');
  let warning=null;try{await savePdf(data.id,'estado_cuenta')}catch(e){warning=e.message}
  return reply({ok:true,warning});
 }catch(e){return fail(e,400);}
}
