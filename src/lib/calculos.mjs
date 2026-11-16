/** Cálculos monetarios para ventas y créditos. Todas las cifras finales en centavos. */
export const dinero = v => Math.round((Number(v)||0)*100)/100;
export function resumenVenta({partidas=[],tasaIva=0,enganche=0}={}){
 const subtotal=dinero(partidas.reduce((s,p)=>s+dinero(Number(p.cantidad||0)*Number(p.precio_unitario||0)),0));
 const iva=dinero(subtotal*Number(tasaIva||0)/100);const total=dinero(subtotal+iva);
 return {subtotal,iva,total,enganche:dinero(enganche),saldo:Math.max(0,dinero(total-enganche))};
}
export function resumenPagos(orden,abonos=[]){
 const total=dinero(orden.total);
 const abonado=dinero(abonos.filter(a=>a.estado==='vigente').reduce((s,a)=>s+Number(a.monto||0),0));
 return {total,abonado,saldo:Math.max(0,dinero(total-abonado))};
}

/**
 * Presentación de partidas con IVA incluido sin alterar el precio base almacenado.
 * Distribuye el IVA total de la orden por proporción en centavos para que
 * los importes finales siempre sumen exactamente al total de venta.
 */
export function partidasConIva(orden={},partidas=[]){
 const bases=partidas.map(p=>Math.max(0,Math.round(dinero(p.importe??(Number(p.cantidad||0)*Number(p.precio_unitario||0)))*100)));
 const sumaBases=bases.reduce((s,c)=>s+c,0);
 const ivaCentavos=Math.max(0,Math.round(dinero(orden.iva||0)*100));
 let baseAcumulada=0,ivaAcumulado=0;
 return partidas.map((p,i)=>{
  baseAcumulada+=bases[i];
  const ivaObjetivo=sumaBases>0?Math.round(ivaCentavos*baseAcumulada/sumaBases):0;
  const importe=dinero((bases[i]+ivaObjetivo-ivaAcumulado)/100);
  ivaAcumulado=ivaObjetivo;
  const cantidad=Number(p.cantidad||0);
  return {...p,importe_con_iva:importe,precio_unitario_con_iva:cantidad>0?dinero(importe/cantidad):0};
 });
}
