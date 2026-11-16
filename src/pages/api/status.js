import {settings,getDb} from '../../lib/server/db.mjs';
import {reply} from '../../lib/server/http.mjs';
export const prerender=false;
export async function GET(){
 const cfg=settings();
 if(!cfg.hasUrl||!cfg.hasSecret)return reply({ok:false,connected:false,message:!cfg.hasUrl?'Falta configurar SUPABASE_URL en .env.':'Falta la clave privada del servidor.'});
 try{
  const {error}=await getDb().from('clientes').select('id',{count:'exact',head:true});
  if(error)return reply({ok:false,connected:false,message:`Conexión establecida; revisa el SQL de las tablas: ${error.message}`});
  const {error:deviceError}=await getDb().from('dispositivos').select('id',{count:'exact',head:true});
  if(deviceError)return reply({ok:false,connected:false,message:'Falta actualización de clientes y dispositivos. Ejecuta supabase/00_INSTALAR_TODO_GRIPXELL.sql: '+deviceError.message});
  return reply({ok:true,connected:true,message:'Conectado con Supabase'});
 }catch(e){return reply({ok:false,connected:false,message:String(e.message).slice(0,300)});}
}
