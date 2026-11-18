import test from 'node:test';
import assert from 'node:assert/strict';
import {validarEdicionExpediente} from '../src/lib/expediente.mjs';
const orden={id:'orden1',cliente_id:'cliente1',dispositivo_id:null,estado:'vigente',folio:20,total:2001};
const cliente={id:'cliente1',rfc:''};
const equipo={id:'equipo1',cliente_id:'cliente1',estado:'activo'};
test('vincula el equipo del cliente y guarda el RFC, sin cambiar importes',()=>{
 const x=validarEdicionExpediente(orden,cliente,equipo,'equipo1',' xaxx010101000 ');
 assert.deepEqual(x,{rfc:'XAXX010101000',dispositivo_id:'equipo1',editaRfc:true,editaDispositivo:true});
 assert.equal(orden.total,2001);assert.equal(orden.folio,20);
});
test('mantiene una orden sin equipo',()=>{
 const x=validarEdicionExpediente(orden,cliente,null,null,'');
 assert.equal(x.editaRfc,false);assert.equal(x.editaDispositivo,false);
});
test('rechaza un equipo de otro cliente',()=>{
 assert.throws(()=>validarEdicionExpediente(orden,cliente,{...equipo,cliente_id:'otro'},'equipo1',''),/no pertenece/);
});
test('rechaza equipo dado de baja',()=>{
 assert.throws(()=>validarEdicionExpediente(orden,cliente,{...equipo,estado:'baja'},'equipo1',''),/dado de baja/);
});
test('mantiene el equipo histórico en una orden pagada',()=>{
 const x=validarEdicionExpediente({...orden,dispositivo_id:'equipo1',estado:'pagada'},cliente,{...equipo,estado:'baja'},'equipo1','ABC');
 assert.equal(x.editaDispositivo,false);assert.equal(x.rfc,'ABC');
});
test('rechaza órdenes canceladas y RFC excesivo',()=>{
 assert.throws(()=>validarEdicionExpediente({...orden,estado:'cancelada'},cliente,null,null,''),/cancelada/);
 assert.throws(()=>validarEdicionExpediente(orden,cliente,null,null,'X'.repeat(21)),/20 caracteres/);
});
