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
