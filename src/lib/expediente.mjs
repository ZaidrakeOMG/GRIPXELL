/** Validate an identity-only correction to an existing GRIPXELL sale. */
export function validarEdicionExpediente(orden,cliente,dispositivo,dispositivoId,rfcInput) {
 if(!orden || !cliente || orden.cliente_id!==cliente.id) throw Error('Orden o cliente no encontrado');
 if(orden.estado==='cancelada') throw Error('No se puede modificar una orden cancelada');
 if(typeof rfcInput!=='string') throw Error('Indica el RFC del cliente (puede quedar vacío)');
 const rfc=rfcInput.trim().toUpperCase();
 if(rfc.length>20) throw Error('El RFC no puede superar 20 caracteres');
 if(dispositivoId && (!dispositivo || dispositivo.id!==dispositivoId || dispositivo.cliente_id!==cliente.id))
  throw Error('El dispositivo no pertenece al cliente de esta orden');
 if(dispositivoId && dispositivo.estado!=='activo' && orden.dispositivo_id!==dispositivoId)
  throw Error('No se puede vincular un dispositivo dado de baja');
 return {
  rfc,dispositivo_id:dispositivoId,
  editaRfc:rfc!==String(cliente.rfc||'').trim().toUpperCase(),
  editaDispositivo:(orden.dispositivo_id||null)!==dispositivoId
 };
}
