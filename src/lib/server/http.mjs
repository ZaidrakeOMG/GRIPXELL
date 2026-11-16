export function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function fail(error,status=500){return reply({ok:false,error:String(error?.message||error)},status);}
export function assertSameOrigin(request){
 const origin=request.headers.get('Origin');
 const target=new URL(request.url).origin;
 const site=request.headers.get('Sec-Fetch-Site');
 if((origin&&origin!==target)||(site&&['cross-site','same-site'].includes(site))) throw new Error('Peticion desde otro origen rechazada');
}
export async function jsonBody(request){
 assertSameOrigin(request);
 const ctype=request.headers.get('content-type')||'';
 if(!ctype.includes('application/json'))throw new Error('Se esperaba JSON');
 const raw=await request.text();if(raw.length>150000)throw new Error('Solicitud demasiado grande');
 try{return JSON.parse(raw)}catch{throw new Error('JSON invalido')}
}
export const txt=(x,n=200)=>String(x??'').trim().slice(0,n);
export function decimal(x,label='Importe'){
 const n=Number(x);if(!Number.isFinite(n)||n<0||n>999999999)throw new Error(`${label} incorrecto`);return Math.round(n*100)/100;
}
export function asDate(x){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(x));if(!m)throw new Error('Fecha incorrecta');const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));if(d.toISOString().slice(0,10)!==x)throw new Error('Fecha incorrecta');return x;}
export const validUuid =x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x));
