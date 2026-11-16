import PDFDocument from 'pdfkit';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {historialPagos} from '../historial-pagos.mjs';

const logo = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/gripxell-logo.png'));
const C = {white:'#FFFFFF',ink:'#1C2937',deep:'#083E45',teal:'#1DA6A7',mint:'#EDF9F8',pale:'#F5FAFA',line:'#DCE9EB',muted:'#708189',warning:'#8A651C',inactive:'#A54E49'};
const W=612, H=792, X=35, CW=542, END=727;
const moneda=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const df=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?`${m[3]}/${m[2]}/${m[1]}`:(s||'—')};
const limpio=(s,otherwise='—')=>String(s??'').trim()||otherwise;
const folio=s=>'N°'+String(s??0).padStart(6,'0');
const txt=(d,s,x,y,w,size=10,color=C.ink,bold=false,opts={})=>d.fillColor(color).font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).text(String(s??''),x,y,{width:w,...opts});
const rect=(d,x,y,w,h,color,r=8)=>d.roundedRect(x,y,w,h,r).fill(color);
const line=(d,x,y,x2,y2,color=C.line)=>d.strokeColor(color).lineWidth(1).moveTo(x,y).lineTo(x2,y2).stroke();

function cabecera(d,o,tipo,continuacion=false){
 // Identidad corporativa, fondo blanco para impresion y elementos teal discretos
 d.save().fillColor(C.teal).rect(0,0,W,8).fill().restore();
 d.save().fillColor(C.mint).circle(-45,30,70).fill().restore();
 d.image(logo,42,18,{fit:[108,108]});
 line(d,159,28,159,120,C.line);
 txt(d,tipo==='nota'?'NOTA DE VENTA':'ESTADO DE CUENTA',176,38,246,19,C.ink,true);
 txt(d,'GRIPXELL · SMART PHONES Y MAS',176,70,230,9,C.muted,true);
 rect(d,176,95,88,4,C.teal,2);
 if(continuacion)txt(d,'CONTINUACIÓN',176,107,175,9,C.teal,true);
 rect(d,433,30,144,57,C.deep,9);
 txt(d,'FOLIO',449,39,110,9,'#BDE4E1',true);
 txt(d,folio(o.folio),445,53,120,21,C.white,true,{align:'right'});
 rect(d,433,90,144,34,C.mint,7);
 txt(d,'FECHA',444,100,35,8,C.deep,true);
 txt(d,df(o.fecha),482,99,84,10,C.deep,true,{align:'right'});
}
function pie(d){
 const range=d.bufferedPageRange();
 for(let i=0;i<range.count;i++){
  d.switchToPage(range.start+i);
  line(d,52,750,218,750,C.teal);line(d,399,750,562,750,C.teal);
  txt(d,'GRIPXELL  |  SMART PHONES Y MAS',204,743,195,9,C.muted,true,{align:'center'});
  txt(d,`Página ${i+1} de ${range.count}`,486,763,77,8,C.muted,false,{align:'right'});
 }
}
function newPage(d,o,tipo){d.addPage();cabecera(d,o,tipo,true);return 143;}
function ensure(d,y,height,o,tipo){return y+height>END?newPage(d,o,tipo):y;}
function clienteCard(d,c,o,tipo,y,dispositivo){
 y=ensure(d,y,132,o,tipo);
 rect(d,X,y,CW,126,C.mint,13);
 rect(d,X+10,y+12,5,103,C.teal,3);
 txt(d,'CLIENTE',X+31,y+13,135,9,C.deep,true);
 txt(d,limpio(c.nombre),X+31,y+31,CW-60,17,C.ink,true,{height:27});
 txt(d,'IMEI:',X+31,y+61,52,9,C.deep,true);
 txt(d,limpio(dispositivo?.imei,'Sin equipo asociado'),X+90,y+60,CW-120,9,C.ink,false,{height:13});
 line(d,X+31,y+79,X+CW-25,y+79,'#CCE3E3');
 txt(d,'DIRECCIÓN:',X+31,y+87,72,9,C.deep,true);
 txt(d,limpio(c.direccion),X+107,y+86,CW-140,9,C.ink,false,{height:13});
 txt(d,'CIUDAD:',X+31,y+108,57,9,C.deep,true);
 txt(d,limpio(c.ciudad),X+95,y+107,206,9,C.ink);
 txt(d,'RFC:',X+315,y+108,34,9,C.deep,true);
 txt(d,limpio(c.rfc),X+350,y+107,152,9,C.ink);
 return y+143;
}
function concepto(d,o,partidas,abonos,y,tipo,dispositivo){
 y=ensure(d,y,122,o,tipo);
 txt(d,'CONCEPTO',X+5,y+4,142,10,C.muted,true);
 const p=dispositivo?.descripcion || partidas?.[0]?.descripcion || 'Equipo y accesorios';
 const concepto=partidas.length>1?`${partidas.length} productos y equipos`:p;
 txt(d,concepto,X+5,y+23,217,16,C.ink,true,{height:54});
 if(dispositivo?.imei)txt(d,`IMEI: ${dispositivo.imei}`,X+5,y+88,215,9,C.muted,true);
 line(d,X+229,y+7,X+229,y+89);
 const abonado=abonos.filter(a=>a.estado==='vigente').reduce((n,a)=>n+Number(a.monto||0),0);
 const cards=[['PRECIO DEL EQUIPO',o.total],['ENGANCHE',o.enganche],['ABONOS ACUMULADOS',abonado]];
 cards.forEach(([label,value],i)=>{
  const cx=X+239+i*103;
  rect(d,cx,y+9,97,82,C.pale,12);
  txt(d,label,cx+5,y+26,87,8,C.muted,true,{align:'center',height:22});
  txt(d,moneda(value),cx+5,y+57,87,12,C.ink,true,{align:'center'});
 });
 return y+120;
}
function listaProductos(d,o,items,y,tipo){
 if((items||[]).length<2)return y;
 y=ensure(d,y,34,o,tipo);txt(d,'DETALLE DE PRODUCTOS',X+4,y,240,11,C.ink,true);y+=21;
 for(let i=0;i<items.length;i++){
  y=ensure(d,y,26,o,tipo);
  if(i%2===0)rect(d,X,y,CW,23,C.pale,0);
  const p=items[i];
  txt(d,`${Number(p.cantidad||0)} × ${limpio(p.descripcion)}`,X+8,y+5,CW-175,9,C.ink);
  txt(d,moneda((Number(p.cantidad)||0)*(Number(p.precio_unitario)||0)),X+CW-144,y+5,130,9,C.ink,true,{align:'right'});
  y+=26;
 }
 return y+8;
}
function resumen(d,o,pagos,y,tipo){
 y=ensure(d,y,90,o,tipo);
 const abonado=pagos.filter(a=>a.estado==='vigente').reduce((n,a)=>n+Number(a.monto||0),0);
 const total=Number(o.total||0), saldo=Math.max(0,Math.round((total-abonado)*100)/100);
 const xs=[X,X+181,X+362],ws=[171,171,180];
 [['TOTAL',total],['ABONOS',abonado],['RESTA',saldo]].forEach(([label,n],i)=>{
  rect(d,xs[i],y,ws[i],71,i===2?C.teal:C.mint,12);
  txt(d,label,xs[i]+14,y+12,ws[i]-28,10,i===2?C.white:C.muted,true);
  txt(d,moneda(n),xs[i]+14,y+33,ws[i]-28,18,i===2?C.white:C.ink,true);
 });
 return y+83;
}
function cronologia(d,o,abonos,eventos,y,tipo){
 const mov=historialPagos(o,abonos,eventos);
 y=ensure(d,y,64,o,tipo);
 txt(d,'HISTORIAL DE PAGOS',X+3,y,CW-6,16,C.ink,true);line(d,X+223,y+14,X+CW,y+14,'#B5D4D5');y+=29;
 const head=()=>{
  rect(d,X,y,CW,27,C.deep,6);
  for(const [label,x,w,align] of [
   ['FECHA',X+8,72,'left'],['MOVIMIENTO',X+86,179,'left'],
   ['PROGRAMADO',X+266,77,'center'],['ABONO',X+347,65,'right'],
   ['ACUMULADO',X+415,66,'right'],['SALDO',X+485,49,'right']
  ])txt(d,label,x,y+8,w,8,C.white,true,{align});
  y+=31;
 };
 head();
 let index=0;
 for(const m of mov){
  const current=ensure(d,y,24,o,tipo);
  if(current!==y){y=current;head();}
  if(index%2===0)rect(d,X,y,CW,23,C.pale,0);
  txt(d,df(m.fecha),X+8,y+6,72,8,C.ink);
  txt(d,m.etiqueta,X+86,y+6,179,7.6,m.tipo==='sin_pago'?C.warning:m.tipo==='anulado'?C.inactive:C.deep,m.tipo!=='anulado');
  txt(d,df(m.fecha_programada),X+266,y+6,77,7.6,C.muted,false,{align:'center'});
  txt(d,m.importe?moneda(m.importe):'—',X+347,y+6,65,7.6,C.ink,false,{align:'right'});
  txt(d,moneda(m.acumulado),X+415,y+6,66,7.6,C.teal,true,{align:'right'});
  txt(d,moneda(m.saldo),X+485,y+6,49,7.6,C.ink,true,{align:'right'});
  y+=23;index++;
 }
 if(!mov.length){txt(d,'No hay pagos registrados todavía.',X+10,y+8,CW-20,10,C.muted);y+=28;}
 return y+13;
}
function condicion(d,o,y,tipo){
 y=ensure(d,y,48,o,tipo);
 rect(d,X,y,CW,42,C.pale,9);
 txt(d,'CONDICIONES',X+12,y+8,110,9,C.muted,true);
 txt(d,`Venta ${o.tipo_venta==='credito'?'a crédito':'de contado'}  ·  Enganche ${moneda(o.enganche)}  ·  Cuota semanal ${Number(o.abono_semanal)>0?moneda(o.abono_semanal):'No pactada'}`,X+12,y+23,CW-24,9,C.ink,true);
 return y+52;
}
function notas(d,o,y,tipo){
 if(!o.observaciones)return y;
 y=ensure(d,y,41,o,tipo);
 txt(d,'OBSERVACIONES',X+3,y,130,9,C.muted,true);
 txt(d,o.observaciones,X+3,y+15,CW-6,9,C.ink,false,{height:20});
 return y+40;
}
export function createPdf(info,tipo='estado_cuenta'){
 return new Promise((resolve,reject)=>{
  const d=new PDFDocument({size:'LETTER',margin:0,bufferPages:true,compress:true,info:{Title:'GRIPXELL - Estado de cuenta',Author:'GRIPXELL'}});
  const chunks=[];d.on('data',b=>chunks.push(b));d.on('error',reject);d.on('end',()=>resolve(Buffer.concat(chunks)));
  const {orden,cliente,partidas=[],abonos=[],eventos=[]}=info;
  cabecera(d,orden,tipo);
  let y=145;
  y=clienteCard(d,cliente,orden,tipo,y,info.dispositivo);
  y=concepto(d,orden,partidas,abonos,y,tipo,info.dispositivo);
  y=listaProductos(d,orden,partidas,y,tipo);
  if(tipo==='estado_cuenta')y=cronologia(d,orden,abonos,eventos,y,tipo);
  y=condicion(d,orden,y,tipo);
  y=resumen(d,orden,abonos,y,tipo);
  if(tipo==='nota'){
   y=ensure(d,y,56,orden,tipo);
   line(d,70,y+25,272,y+25,C.muted);
   txt(d,'Firma de conformidad',92,y+31,180,9,C.muted);
   y+=53;
  }
  notas(d,orden,y,tipo);
  pie(d);d.end();
 });
}
export const pdfName=(orden,tipo)=>`GRIPXELL_${tipo==='nota'?'NOTA':'ESTADO_DE_CUENTA'}_${String(orden.folio).padStart(6,'0')}.pdf`;
