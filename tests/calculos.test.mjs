import test from 'node:test';
import assert from 'node:assert/strict';
import {resumenVenta,resumenPagos,partidasConIva} from '../src/lib/calculos.mjs';

test('Equipo de ejemplo, enganche y crédito',()=>{
 const r=resumenVenta({partidas:[{cantidad:1,precio_unitario:19500}],enganche:3000});
 assert.deepEqual(r,{subtotal:19500,iva:0,total:19500,enganche:3000,saldo:16500});
});
test('Factura con IVA y múltiples partidas',()=>{
 const r=resumenVenta({partidas:[{cantidad:2,precio_unitario:1200},{cantidad:1,precio_unitario:100}],tasaIva:16});
 assert.equal(r.subtotal,2500);assert.equal(r.iva,400);assert.equal(r.total,2900);
});
test('Histórico de Yuliana ejemplo, saldo pendiente exacto',()=>{
 const amounts=[3000,5000,300,250,350,500,500,400,400,400,350];
 const r=resumenPagos({total:19500},amounts.map(monto=>({monto,estado:'vigente'})));
 assert.deepEqual(r,{total:19500,abonado:11450,saldo:8050});
});
test('No se resta abono anulado',()=>{
 assert.deepEqual(resumenPagos({total:500},[{monto:100,estado:'vigente'},{monto:300,estado:'anulado'}]),{total:500,abonado:100,saldo:400});
});
test('Sin pago no se contabiliza como pago',()=>{
 assert.deepEqual(resumenPagos({total:500},[{monto:0,estado:'vigente'}]),{total:500,abonado:0,saldo:500});
});
test('Redondea por partida como Postgres',()=>{
 const r=resumenVenta({partidas:[{cantidad:1.33,precio_unitario:15.15},{cantidad:2,precio_unitario:0.12}]});
 assert.equal(r.subtotal,20.39);
});

test('Detalle de venta con IVA muestra precio e importe finales sin cambiar saldo',()=>{
 const orden={subtotal:1725,iva:276,total:2001};
 const items=partidasConIva(orden,[{cantidad:1,descripcion:'Smartwatch',precio_unitario:1725,importe:1725}]);
 assert.equal(items[0].precio_unitario,1725);
 assert.equal(items[0].precio_unitario_con_iva,2001);
 assert.equal(items[0].importe_con_iva,2001);
 assert.deepEqual(resumenPagos(orden,[{monto:100,estado:'vigente'}]),{total:2001,abonado:100,saldo:1901});
});
test('IVA prorrateado entre varios artículos suma exactamente al total',()=>{
 const orden={subtotal:2500,iva:400,total:2900};
 const items=partidasConIva(orden,[{cantidad:2,precio_unitario:1200,importe:2400},{cantidad:1,precio_unitario:100,importe:100}]);
 assert.deepEqual(items.map(p=>p.importe_con_iva),[2784,116]);
 assert.equal(items.reduce((s,p)=>s+p.importe_con_iva,0),orden.total);
 assert.equal(items[0].precio_unitario_con_iva,1392);
});
test('Reparto de centavos no crea ni pierde IVA y la venta sin IVA no cambia',()=>{
 const items=partidasConIva({iva:0.01},Array.from({length:3},()=>({cantidad:1,precio_unitario:0.01,importe:0.01})));
 assert.equal(Math.round(items.reduce((s,p)=>s+p.importe_con_iva,0)*100),4);
 const sinIva=partidasConIva({iva:0},[{cantidad:1,precio_unitario:1725,importe:1725}]);
 assert.equal(sinIva[0].importe_con_iva,1725);
});
