import {writeFile} from 'node:fs/promises';
import {createPdf} from '../src/lib/server/pdf.mjs';
const sample={
 orden:{folio:1417,fecha:'2026-03-17',tipo_venta:'credito',total:19500,enganche:3000,abono_semanal:350,observaciones:'Muestra de diseño, no es una operación real'},
 cliente:{nombre:'CLIENTE DE EJEMPLO',direccion:'Gómez Palacio, Durango',ciudad:'Gómez Palacio',rfc:''},
 partidas:[{cantidad:1,descripcion:'iPhone 15 negro',precio_unitario:19500,importe:19500}],
 abonos:[
 {fecha_pago:'2026-03-17',tipo_pago:'enganche',monto:3000,estado:'vigente'},
 {fecha_pago:'2026-03-21',tipo_pago:'abono',monto:5000,estado:'vigente',referencia:'Pagos acumulados marzo-agosto'},
 ...[['2026-08-28',300],['2026-09-13',250],['2026-09-19',350],['2026-09-25',500],['2026-10-04',500],['2026-10-09',400],['2026-10-23',400],['2026-10-30',400],['2026-11-07',350]].map(([fecha_pago,monto])=>({fecha_pago,monto,estado:'vigente',tipo_pago:'abono'}))
 ],
 eventos:[{tipo_movimiento:'sin_pago',descripcion:'Semana sin pago',datos_nuevos:{fecha:'2026-08-22'},fecha_movimiento:'2026-08-22'},{tipo_movimiento:'sin_pago',descripcion:'Semana sin pago',datos_nuevos:{fecha:'2026-10-17'},fecha_movimiento:'2026-10-17'}]
};
const pdf=await createPdf(sample,'estado_cuenta');
await writeFile('GRIPXELL_Ejemplo_Generador.pdf',pdf);
console.log('Se creó GRIPXELL_Ejemplo_Generador.pdf');
