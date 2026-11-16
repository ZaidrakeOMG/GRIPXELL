import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizarImei, puedeVender} from '../src/lib/cliente.mjs';

test('IMEI identifica el dispositivo, no es correo electrónico',()=>{
 assert.equal(normalizarImei('  123456789012345  '),'123456789012345');
 assert.equal(normalizarImei('123-456-789-012-345'),'123456789012345');
 assert.equal(normalizarImei(''),'');
});
test('validación de IMEI de 15 dígitos',()=>{
 for(const x of ['123','abc@correo.com','abcdefghijklmno','1234567890123456','12345678901234a']){
  assert.throws(()=>normalizarImei(x));
 }
 assert.throws(()=>normalizarImei('',{obligatorio:true}));
});
test('un cliente dado de baja no puede recibir nuevas ventas',()=>{
 const c={id:'cliente-1',estado:'baja'};
 assert.equal(puedeVender(c),false);
 assert.equal(puedeVender({...c,estado:'activo'}),true);
});
test('dispositivo vinculado solo puede venderse al cliente propietario',()=>{
 const c={id:'cliente-1',estado:'activo'};
 assert.equal(puedeVender(c,{cliente_id:c.id,estado:'activo'}),true);
 assert.equal(puedeVender(c,{cliente_id:'cliente-2',estado:'activo'}),false);
 assert.equal(puedeVender(c,{cliente_id:c.id,estado:'baja'}),false);
});
test('SQL integral crea 7 tablas, operaciones, IMEI único y RLS',()=>{
 const sql=readFileSync(new URL('../supabase/00_INSTALAR_TODO_GRIPXELL.sql',import.meta.url),'utf8');
 for(const phrase of [
  'gripxell_dispositivos_imei_unico',
  'gripxell_orden_dispositivo_mismo_cliente',
  'public.gripxell_crear_cliente_con_dispositivo',
  'public.gripxell_registrar_abono_con_fecha',
  'public.gripxell_crear_orden_con_dispositivo',
  'ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY',
  'gripxell_registrar_sin_pago',
  "NOTIFY pgrst, 'reload schema'"
 ])assert.ok(sql.includes(phrase),phrase);
 assert.ok(!sql.includes('El correo es obligatorio'));
});
test('frontend busca cliente por IMEI y elimina campo de correo del formulario',()=>{
 const ui=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/scripts/app.mjs',import.meta.url),'utf8');
 assert.ok(ui.includes('Buscar cliente por IMEI'));
 assert.ok(!ui.includes('id="clientEmail"'));
 assert.ok(app.includes('const imeisFor='));
 assert.ok(!app.includes('emailFor'));
});
