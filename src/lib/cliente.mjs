/** IMEI del dispositivo: 15 dígitos; el cliente se identifica internamente por UUID. */
export function normalizarImei(value, {obligatorio=false}={}) {
 const original=String(value??'').trim();
 if (!original) {
  if(obligatorio)throw Error('El IMEI del teléfono es obligatorio');
  return '';
 }
 const imei=original.replace(/[\s-]/g,'');
 if(!/^\d{15}$/.test(imei))throw Error('El IMEI debe tener exactamente 15 dígitos');
 return imei;
}
export function puedeVender(cliente,dispositivo) {
 if(!cliente || cliente.estado==='baja')return false;
 return !dispositivo || (dispositivo.cliente_id===cliente.id && dispositivo.estado==='activo');
}
