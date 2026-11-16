import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

let cached;
export function settings() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const secret = (process.env.SUPABASE_SECRET_KEY || '').trim();
  return { url, hasUrl: /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url), hasSecret: secret.startsWith('sb_secret_') || secret.length > 100 };
}
export function getDb(){
  const cfg=settings();
  if (!cfg.hasUrl || !cfg.hasSecret) {
    throw new Error(!cfg.hasUrl ? 'Falta SUPABASE_URL en el archivo .env. Ve a Supabase > Project Settings > Data API > Project URL.' : 'Falta SUPABASE_SECRET_KEY en el archivo .env.');
  }
  if (!cached) cached = createClient(cfg.url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return cached;
}
export function check(result,label='Supabase'){
  if (result?.error) throw new Error(`${label}: ${result.error.message}`);
  return result?.data;
}
export const money = v=>Math.round((Number(v)||0)*100)/100;
export function saldoDe(orden,abonos=[]){
  const total=money(orden.total);
  const abonado=money(abonos.filter(a=>a.estado==='vigente').reduce((s,a)=>s+Number(a.monto||0),0));
  return {total,abonado,saldo:Math.max(0,money(total-abonado))};
}
export async function loadOrder(id){
 const db=getDb();
 const order=check(await db.from('ordenes').select('*').eq('id',id).single(),'Orden');
 const [client,items,payments,docs,events,device]=await Promise.all([
  db.from('clientes').select('*').eq('id',order.cliente_id).single(),
  db.from('orden_detalles').select('*').eq('orden_id',id).order('descripcion'),
  db.from('abonos').select('*').eq('orden_id',id).order('fecha_pago',{ascending:true}).order('fecha_registro',{ascending:true}),
  db.from('documentos').select('*').eq('orden_id',id).order('fecha_generacion',{ascending:false}),
  db.from('historial_movimientos').select('*').eq('orden_id',id).order('fecha_movimiento',{ascending:false}).limit(200),
  order.dispositivo_id?db.from('dispositivos').select('*').eq('id',order.dispositivo_id).single():Promise.resolve({data:null,error:null})
 ]);
 return {orden:order, cliente:check(client,'Cliente'), partidas:check(items,'Productos'), abonos:check(payments,'Abonos'), documentos:check(docs,'Documentos'), eventos:check(events,'Historial'), dispositivo:check(device,'Dispositivo')};
}
