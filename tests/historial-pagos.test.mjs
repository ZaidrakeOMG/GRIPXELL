import test from 'node:test';
import assert from 'node:assert/strict';
import {historialPagos,fechaLarga} from '../src/lib/historial-pagos.mjs';
const orden = { total:1000 };
test('fecha en que se debia pagar y pago tardio aparecen por separado', () => {
  const h=historialPagos(orden,[
    {id:'a',fecha_pago:'2026-12-01',monto:100,estado:'vigente',tipo_pago:'abono'},
    {id:'b',fecha_pago:'2026-12-10',fecha_programada:'2026-12-05',monto:100,estado:'vigente',tipo_pago:'abono'}
  ]);
  assert.deepEqual(h.map(x=>x.etiqueta),[
    'Pago del 01/diciembre/2026','Sin pago 05/diciembre/2026','Pago del 10/diciembre/2026'
  ]);
  assert.deepEqual(h.map(x=>x.saldo),[900,900,800]);
  assert.equal(h[2].fecha_programada,'2026-12-05');
});
test('si se marco manualmente sin pago, no duplica el registro automatico', () => {
  const h=historialPagos(orden,[{id:'b',fecha_pago:'2026-12-10',fecha_programada:'2026-12-05',monto:50,estado:'vigente',tipo_pago:'abono'}], [
    {tipo_movimiento:'sin_pago',descripcion:'Semana sin pago',datos_nuevos:{fecha:'2026-12-05'}}
  ]);
  assert.equal(h.filter(x=>x.tipo==='sin_pago').length,1);
  assert.deepEqual(h.map(x=>x.saldo),[1000,950]);
});
test('sin pago sin abonos guarda el saldo intacto', () => {
 const h=historialPagos(orden,[],[{tipo_movimiento:'sin_pago',datos_nuevos:{fecha:'2026-12-05'}}]);
 assert.equal(h.length,1);assert.equal(h[0].saldo,1000);
});
test('abono anulado no disminuye saldo ni inventa sin pago',()=>{
 const h=historialPagos(orden,[{id:'x',fecha_pago:'2026-12-10',fecha_programada:'2026-12-05',monto:100,estado:'anulado',tipo_pago:'abono'}]);
 assert.equal(h.length,1); assert.equal(h[0].saldo,1000);assert.equal(h[0].importe,0);
});
test('no se marca sin pago si pago en fecha o antes',()=>{
 const h=historialPagos(orden,[{id:'x',fecha_pago:'2026-12-04',fecha_programada:'2026-12-05',monto:50,estado:'vigente'}]);
 assert.deepEqual(h.map(x=>x.tipo),['pago']);
});
test('formato fecha',()=>assert.equal(fechaLarga('2026-12-10'),'10/diciembre/2026'));


test('dos pagos el mismo dia aparecen separados y el acumulado es la suma',()=>{
 const h=historialPagos({total:2000},[
  {id:'p1',fecha_pago:'2026-11-15',fecha_registro:'2026-11-15T12:00:00Z',monto:100,estado:'vigente',tipo_pago:'abono'},
  {id:'p2',fecha_pago:'2026-11-15',fecha_registro:'2026-11-15T12:05:00Z',monto:500,estado:'vigente',tipo_pago:'abono'}
 ]);
 assert.equal(h.length,2);
 assert.deepEqual(h.map(x=>x.etiqueta),['Pago 1/2 del 15/noviembre/2026','Pago 2/2 del 15/noviembre/2026']);
 assert.deepEqual(h.map(x=>x.importe),[100,500]);
 assert.deepEqual(h.map(x=>x.acumulado),[100,600]);
 assert.deepEqual(h.map(x=>x.saldo),[1900,1400]);
});

test('sin pago no cambia el acumulado y al pagar despues se suma',()=>{
 const h=historialPagos({total:2000},[
  {id:'p1',fecha_pago:'2026-11-15',monto:100,estado:'vigente',tipo_pago:'abono'},
  {id:'p2',fecha_pago:'2026-11-28',fecha_programada:'2026-11-21',monto:500,estado:'vigente',tipo_pago:'abono'}
 ],[{tipo_movimiento:'sin_pago',descripcion:'No pago',datos_nuevos:{fecha:'2026-11-21'}}]);
 assert.deepEqual(h.map(x=>x.acumulado),[100,100,600]);
 assert.deepEqual(h.map(x=>x.saldo),[1900,1900,1400]);
 assert.equal(h.filter(x=>x.tipo==='sin_pago').length,1);
});

test('pago anulado no se suma al total acumulado',()=>{
 const h=historialPagos({total:2000},[
  {id:'p1',fecha_pago:'2026-11-15',monto:100,estado:'vigente',tipo_pago:'abono'},
  {id:'p2',fecha_pago:'2026-11-15',monto:500,estado:'anulado',tipo_pago:'abono'},
  {id:'p3',fecha_pago:'2026-11-16',monto:500,estado:'vigente',tipo_pago:'abono'}
 ]);
 assert.deepEqual(h.map(x=>x.acumulado),[100,100,600]);
 assert.equal(h.at(-1).saldo,1400);
});
