import {reply} from '../../lib/server/http.mjs';
export const prerender=false;
export async function POST(){return reply({ok:false,error:'La importación de demostración está deshabilitada en la versión de entrega.'},410);}
