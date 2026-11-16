import test from 'node:test';
import assert from 'node:assert/strict';
import {resumenVenta,resumenPagos} from '../src/lib/calculos.mjs';

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
