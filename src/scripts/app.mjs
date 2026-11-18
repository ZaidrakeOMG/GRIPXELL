import {historialPagos} from '../lib/historial-pagos.mjs';
import {partidasConIva} from '../lib/calculos.mjs';
/* GRIPXELL — Sin login. Solo llamadas a Astro /api; ninguna clave de Supabase llega al navegador. */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const dateFmt=s=>{if(!s)return '—';const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);return m?`${m[3]}/${m[2]}/${m[1]}`:String(s).slice(0,10)};
const e=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const folio=s=>`N°${String(s??0).padStart(6,'0')}`;
const st={clientes:[],ordenes:[],documentos:[],abonos:[],dispositivos:[],actual:null,editando:null,deviceClientId:null,devicesClientId:null,loading:false};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
let toastTimer;
function toast(text,error=false){const el=$('#toast');el.textContent=text;el.classList.toggle('error',error);el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),5500)}
async function api(path,{method='GET',body}={}){
 const res=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 let data;try{data=await res.json()}catch{throw Error('El servidor no devolvió una respuesta válida')}
 if(!res.ok||data.ok===false)throw Error(data.error||data.message||`Error ${res.status}`);
 return data;
}
const nameFor=id=>st.clientes.find(c=>c.id===id)?.nombre||'Cliente no encontrado';
const imeisFor=id=>st.dispositivos.filter(d=>d.cliente_id===id).map(d=>d.imei).filter(Boolean).join(' ');
const devicesFor=id=>st.dispositivos.filter(d=>d.cliente_id===id);
const clientFor=id=>st.clientes.find(c=>c.id===id);
const deviceFor=id=>st.dispositivos.find(d=>d.id===id);
const paymentsFor=id=>st.abonos.filter(a=>a.orden_id===id&&a.estado==='vigente').reduce((n,a)=>n+Number(a.monto||0),0);
const remain=o=>Math.max(0,Math.round((Number(o.total||0)-paymentsFor(o.id))*100)/100);
const escapeCsv=x=>'"'+String(x??'').replaceAll('"','""')+'"';
function saveCsv(filename,rows){const body='\ufeff'+rows.map(r=>r.map(escapeCsv).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8'}));a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
function go(screen){$$('[data-screen]').forEach(v=>v.classList.toggle('active',v.dataset.screen===screen));$$('.nav-link').forEach(v=>v.classList.toggle('active',v.dataset.nav===screen));window.scrollTo({top:0,behavior:'smooth'});if(screen==='historico')renderOrders();if(screen==='reportes')renderDocs();if(screen==='administracion')renderAdminClients()}
async function refresh(){const x=await api('/api/overview');Object.assign(st,{clientes:x.clientes||[],ordenes:x.ordenes||[],documentos:x.documentos||[],abonos:x.abonos||[],dispositivos:x.dispositivos||[]});renderAll()}
async function connection(){try{const s=await api('/api/status');$('#leftDot').classList.add('online');$('#leftStatus').textContent='Conectado con Supabase';$('#connectionLabel').textContent='Base conectada';$('#statusDetail').textContent='Conexión a Supabase activa';$('#setupWarning').classList.add('hidden');await refresh()}catch(err){$('#leftDot').classList.remove('online');$('#leftStatus').textContent='Revisar conexión';$('#connectionLabel').textContent='Sin conexión';$('#statusDetail').textContent=err.message;$('#setupWarning').classList.remove('hidden');$('#setupWarning').textContent=`Revisa la conexión: ${err.message}. Si faltan tablas, ejecuta los archivos SQL incluidos en la carpeta supabase desde el SQL Editor del proyecto.`;toast(err.message,true)}}
function renderAll(){
 renderMetrics();renderClients();renderOrders();renderDocs();renderClientSelector();renderAdminClients();
}
function renderClientSelector(){
 const select=$('#orderClient'),current=select.value;
 const query=$('#orderClientSearch').value.trim().toLowerCase();
 const candidatos=st.clientes.filter(c=>c.estado!=='baja'&&(`${c.nombre} ${c.telefono||''} ${imeisFor(c.id)} ${devicesFor(c.id).map(d=>d.descripcion).join(' ')}`).toLowerCase().includes(query));
 select.innerHTML='<option value="">Seleccionar cliente</option>'+candidatos.map(c=>`<option value="${e(c.id)}">${e(c.nombre)} — ${e(imeisFor(c.id)||'Sin equipo registrado')}</option>`).join('');
 if(candidatos.some(c=>c.id===current))select.value=current;
 renderDeviceSelect();
}
function renderDeviceSelect(){
 const select=$('#orderDevice'),current=select.value,cliente=$('#orderClient').value;
 const equipos=st.dispositivos.filter(d=>d.cliente_id===cliente&&d.estado==='activo');
 select.innerHTML='<option value="">Sin dispositivo asociado (accesorios / venta general)</option>'+equipos.map(d=>`<option value="${e(d.id)}">${e(d.descripcion)}${d.imei?' | IMEI '+e(d.imei):''}</option>`).join('');
 if(equipos.some(d=>d.id===current))select.value=current;
}
function fillDeviceItem(){
 const d=deviceFor($('#orderDevice').value);if(!d)return;
 const rows=$$('.product-row');
 if(rows.length===1){
  const desc=rows[0].querySelector('.description'),price=rows[0].querySelector('.unitprice');
  if(!desc.value.trim()||desc.dataset.deviceFill==='yes'){
   desc.value=d.descripcion;desc.dataset.deviceFill='yes';
   price.value=String(Number(d.precio_venta||0));
   rows[0].querySelector('.quantity').value='1';calc();
  }
 }
}

function renderMetrics(){const valid=st.ordenes.filter(o=>o.estado!=='cancelada');$('#metricOrders').textContent=st.ordenes.length;$('#metricSales').textContent=fmt(valid.reduce((n,o)=>n+Number(o.total||0),0));$('#metricDue').textContent=fmt(valid.reduce((n,o)=>n+remain(o),0));$('#metricClients').textContent=st.clientes.filter(c=>c.estado!=='baja').length;$('#recentOrders').innerHTML=st.ordenes.slice(0,8).map(o=>`<tr><td><strong>${folio(o.folio)}</strong></td><td>${e(nameFor(o.cliente_id))}</td><td>${dateFmt(o.fecha)}</td><td><strong>${fmt(o.total)}</strong></td><td>${badge(o.estado)}</td><td><button class="table-action" data-action="detail" data-id="${e(o.id)}">Ver orden</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Todavía no hay órdenes. Crea la primera venta.</td></tr>'}
const badge=s=>`<span class="tag ${e(s)}">${e(s==='pagada'?'Pagada':s==='cancelada'?'Cancelada':'Vigente')}</span>`;
function renderClients(){
 const q=$('#searchClients').value.trim().toLowerCase();
 const found=st.clientes.filter(c=>(`${c.nombre} ${c.telefono} ${c.rfc} ${c.ciudad} ${devicesFor(c.id).map(d=>d.descripcion+' '+d.imei).join(' ')}`).toLowerCase().includes(q));
 $('#clientRows').innerHTML=found.map(c=>`<tr><td><strong>${e(c.nombre)}</strong><div class="muted">${e(imeisFor(c.id)||'Sin IMEI registrado')}</div></td><td>${e(c.telefono||'—')}</td><td>${devicesFor(c.id).length} registrado(s)</td><td><span class="tag ${c.estado==='baja'?'cancelada':'pagada'}">${c.estado==='baja'?'Baja':'Activo'}</span></td><td><div class="client-actions"><button class="table-action" data-action="client-devices" data-id="${e(c.id)}">Equipos y órdenes</button><button class="table-action" data-action="client-edit" data-id="${e(c.id)}">Editar</button><button class="table-action" data-action="admin-open" data-id="${e(c.id)}">Administrar</button><button class="table-action" data-action="client-status" data-id="${e(c.id)}">${c.estado==='baja'?'Reactivar':'Dar de baja'}</button></div></td></tr>`).join('')||'<tr><td colspan="5" class="empty">No se encontraron clientes</td></tr>';
}

function renderAdminClients(){
 const select=$('#adminClientSelect');if(!select)return;
 const selected=select.value,query=$('#adminClientSearch').value.trim().toLowerCase();
 const matches=st.clientes.filter(c=> (c.nombre+' '+(c.telefono||'')+' '+imeisFor(c.id)).toLowerCase().includes(query));
 select.innerHTML='<option value="">Seleccionar cliente</option>'+matches.map(c=>`<option value="${e(c.id)}">${e(c.nombre)}${imeisFor(c.id)?' - '+e(imeisFor(c.id)):''}</option>`).join('');
 if(matches.some(c=>c.id===selected))select.value=selected;
 showAdminClient();
}
function showAdminClient(){
 const target=$('#adminClientDetail');if(!target)return;
 const c=clientFor($('#adminClientSelect').value);
 if(!c){target.textContent='Selecciona un cliente para consultar su expediente.';return}
 const orders=st.ordenes.filter(o=>o.cliente_id===c.id);
 const ids=new Set(orders.map(o=>o.id));
 const payments=st.abonos.filter(a=>ids.has(a.orden_id));
 const docs=st.documentos.filter(d=>ids.has(d.orden_id));
 target.textContent=c.nombre+' | '+devicesFor(c.id).length+' dispositivos | '+orders.length+' órdenes | '+payments.length+' abonos | '+docs.length+' PDFs históricos';
}
async function deleteAdminCliente(modo){
 const c=clientFor($('#adminClientSelect').value);
 if(!c)throw Error('Selecciona un cliente');
 if(!['historial','cliente'].includes(modo))throw Error('Acción inválida');
 const message=modo==='historial'?'Se eliminarán órdenes, pagos, movimientos y PDFs, pero se conservará el cliente y sus dispositivos.':'Se eliminará permanentemente el cliente junto con sus dispositivos, órdenes, pagos y PDFs.';
 const phrase=(modo==='historial'?'BORRAR HISTORIAL':'BORRAR CLIENTE')+' '+c.nombre;
 const written=prompt(message+' Para confirmar escribe exactamente: '+phrase);
 if(written===null)return;
 if(written!==phrase)throw Error('Confirmación incorrecta. No se borró nada.');
 const codigo=prompt('Escribe el código administrativo de eliminación (no es inicio de sesión):');
 if(codigo===null)return;
 if(!confirm('¿Confirmas el borrado definitivo de '+c.nombre+'? '+message))return;
 let result;
 try{result=await api('/api/administracion',{method:'POST',body:{cliente_id:c.id,modo,confirmacion:phrase,codigo}})}
 catch(err){alert('No se pudo eliminar el expediente.\n\n'+err.message+'\n\nRevisa el SQL 05 de Supabase y el código administrativo configurado en Vercel.');throw err}
 await refresh();
 toast(result.warning||('Eliminación terminada: '+result.ordenes_eliminadas+' órdenes y '+result.abonos_eliminados+' pagos'));
}
function renderOrders(){const q=$('#searchOrders').value.trim().toLowerCase(),v=$('#filterStatus').value;const f=st.ordenes.filter(o=>(!v||v===o.estado)&&(`${o.folio} ${nameFor(o.cliente_id)} ${deviceFor(o.dispositivo_id)?.imei||''} ${deviceFor(o.dispositivo_id)?.descripcion||''}`).toLowerCase().includes(q));$('#countOrders').textContent=`${f.length} órdenes`;$('#historyRows').innerHTML=f.map(o=>`<tr><td><strong>${folio(o.folio)}</strong></td><td>${e(nameFor(o.cliente_id))}</td><td>${dateFmt(o.fecha)}</td><td>${e(o.tipo_venta)}</td><td><strong>${fmt(o.total)}</strong></td><td>${badge(o.estado)}</td><td><button class="table-action" data-action="detail" data-id="${e(o.id)}">Abrir</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">No hay órdenes con ese filtro</td></tr>'}
function renderDocs(){const docs=[...st.documentos].sort((a,b)=>String(b.fecha_generacion).localeCompare(String(a.fecha_generacion)));$('#docCount').textContent=`${docs.length} versiones`;const ids=new Map(st.ordenes.map(o=>[o.id,o.folio]));$('#allDocs').innerHTML=docs.slice(0,150).map(d=>`<tr><td>${folio(ids.get(d.orden_id))}</td><td>${d.tipo_documento==='nota'?'Nota de venta':'Estado de cuenta'}</td><td>v${d.version}</td><td>${dateFmt(d.fecha_generacion)}</td><td><button class="table-action" data-action="download-doc" data-id="${e(d.id)}">Descargar</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">Todavía no hay archivos</td></tr>'}
function addRow(item={cantidad:1,descripcion:'',precio_unitario:''}){const node=document.createElement('div');node.className='product-row';node.innerHTML=`<label>Cantidad<input class="quantity" type="number" min="0.001" step="0.001" value="${e(item.cantidad)}" required></label><label>Descripción<input class="description" maxlength="250" placeholder="Ej. iPhone 15 negro" value="${e(item.descripcion)}" required></label><label>Precio unitario<input class="unitprice" type="number" min="0" step="0.01" value="${e(item.precio_unitario)}" placeholder="0.00" required></label><button type="button" class="remove-item">Quitar</button>`;node.querySelector('.remove-item').onclick=()=>{if($$('.product-row').length<=1){toast('Agrega al menos un producto',true);return}node.remove();calc()};node.querySelectorAll('input').forEach(i=>i.addEventListener('input',calc));$('#itemRows').append(node);calc()}
function calc(){const subtotal=$$('.product-row').reduce((n,row)=>n+(Number(row.querySelector('.quantity').value)||0)*(Number(row.querySelector('.unitprice').value)||0),0);const iva=Math.round(subtotal*(Number($('#ivaPercent').value)||0))/100;const down=Number($('#downPayment').value)||0;$('#previewSubtotal').textContent=fmt(subtotal);$('#previewIva').textContent=fmt(iva);$('#previewTotal').textContent=fmt(subtotal+iva);$('#previewDown').textContent=fmt(down);$('#previewBalance').textContent=fmt(Math.max(0,subtotal+iva-down))}
function newOrder(){go('nueva');$('#orderForm').reset();$('#orderDate').value=today();$('#itemRows').innerHTML='';addRow();renderClientSelector();calc()}
function clientDialog(client){
 st.editando=client?.id||null;
 $('#clientForm').reset();$('#clientDialogTitle').textContent=client?'Editar cliente':'Nuevo cliente';
 $('#clientName').value=client?.nombre||'';
 $('#clientPhone').value=client?.telefono||'';$('#clientRfc').value=client?.rfc||'';
 $('#clientAddress').value=client?.direccion||'';$('#clientCity').value=client?.ciudad||'';
 $('#clientPostal').value=client?.codigo_postal||'';
 $('#firstDeviceBlock').classList.toggle('hidden',!!client);
 $('#clientDialog').showModal();
}
async function saveClient(ev){
 ev.preventDefault();const btn=ev.submitter;btn.disabled=true;
 try{
  const payload={id:st.editando,nombre:$('#clientName').value,
   telefono:$('#clientPhone').value,rfc:$('#clientRfc').value,direccion:$('#clientAddress').value,
   ciudad:$('#clientCity').value,codigo_postal:$('#clientPostal').value,
   dispositivo:{descripcion:$('#firstDeviceDescription').value,marca:$('#firstDeviceBrand').value,
   modelo:$('#firstDeviceModel').value,imei:$('#firstDeviceImei').value,
   precio_venta:Number($('#firstDevicePrice').value)||0}};
  const res=await api('/api/cliente',{method:st.editando?'PUT':'POST',body:payload});
  $('#clientDialog').close();$('#orderClientSearch').value='';await refresh();$('#orderClient').value=res.cliente.id;renderDeviceSelect();
  if(!st.editando){const primero=devicesFor(res.cliente.id).find(d=>d.estado==='activo');if(primero){$('#orderDevice').value=primero.id;fillDeviceItem();}}
  toast('Cliente y datos guardados en Supabase');
 }catch(err){toast(err.message,true)}finally{btn.disabled=false}
}
function showDevices(clienteId){
 const c=clientFor(clienteId);if(!c)return;
 st.devicesClientId=clienteId;
 $('#devicesTitle').textContent=c.nombre;$('#devicesSubtitle').textContent=imeisFor(clienteId)||'Sin equipo con IMEI registrado';
 const records=devicesFor(clienteId);
 const orders=st.ordenes.filter(o=>o.cliente_id===clienteId);
 $('#devicesBody').innerHTML=`<div class="detail-actions" style="margin-bottom:18px"><button class="btn btn-primary" data-action="device-add" data-id="${e(clienteId)}" ${c.estado==='baja'?'disabled':''}>Agregar otro dispositivo</button></div>
 <div class="table-wrap"><table><thead><tr><th>DISPOSITIVO</th><th>IMEI / SERIE</th><th>PRECIO</th><th>ESTADO</th><th></th></tr></thead><tbody>${records.map(d=>`<tr><td><strong>${e(d.descripcion)}</strong><div class="muted">${e([d.marca,d.modelo].filter(Boolean).join(' '))}</div></td><td>${e(d.imei||d.numero_serie||'—')}</td><td>${fmt(d.precio_venta)}</td><td>${d.estado==='activo'?'Activo':'Baja'}</td><td><div class="client-actions">${c.estado==='activo'&&d.estado==='activo'?`<button class="table-action" data-action="order-from-device" data-id="${e(d.id)}">Nueva orden</button>`:''}<button class="table-action" data-action="device-toggle" data-id="${e(d.id)}">${d.estado==='activo'?'Dar de baja':'Reactivar'}</button></div></td></tr>`).join('')||'<tr><td class="empty" colspan="5">Sin dispositivos registrados</td></tr>'}</tbody></table></div>
 <h3 style="margin:24px 0 10px">Órdenes y saldos de este cliente</h3><div class="table-wrap"><table><thead><tr><th>FOLIO</th><th>DISPOSITIVO</th><th>TOTAL</th><th>ABONADO</th><th>SALDO</th><th></th></tr></thead><tbody>${orders.map(o=>`<tr><td>${folio(o.folio)}</td><td>${e(deviceFor(o.dispositivo_id)?.descripcion||'Venta general / orden antigua')}</td><td>${fmt(o.total)}</td><td>${fmt(paymentsFor(o.id))}</td><td>${fmt(remain(o))}</td><td><button class="table-action" data-action="detail" data-id="${e(o.id)}">Ver orden</button></td></tr>`).join('')||'<tr><td class="empty" colspan="6">Sin órdenes registradas</td></tr>'}</tbody></table></div>`;
 $('#devicesDialog').showModal();
}
function deviceDialog(clienteId){
 const c=clientFor(clienteId);if(!c)throw Error('Selecciona primero un cliente');
 if(c.estado==='baja')throw Error('Reactiva al cliente antes de agregar un equipo');
 st.deviceClientId=clienteId;$('#deviceForm').reset();$('#deviceClientName').textContent=c.nombre+' — '+(imeisFor(clienteId)||'Sin IMEI registrado');
 $('#deviceDialog').showModal();
}
async function saveDevice(ev){
 ev.preventDefault();const btn=ev.submitter;btn.disabled=true;
 try{
  const result=await api('/api/dispositivo',{method:'POST',body:{cliente_id:st.deviceClientId,
   descripcion:$('#deviceDescription').value,marca:$('#deviceBrand').value,modelo:$('#deviceModel').value,
   color:$('#deviceColor').value,imei:$('#deviceImei').value,numero_serie:$('#deviceSerial').value,
   precio_venta:Number($('#devicePrice').value)||0,observaciones:$('#deviceNotes').value}});
  const desdeExpediente=$('#devicesDialog').open;
  $('#deviceDialog').close();if(desdeExpediente)$('#devicesDialog').close();
  $('#orderClientSearch').value='';await refresh();$('#orderClient').value=result.dispositivo.cliente_id;renderDeviceSelect();
  $('#orderDevice').value=result.dispositivo.id;
  toast('Nuevo dispositivo registrado para el cliente');
  if(desdeExpediente)showDevices(result.dispositivo.cliente_id);
 }catch(err){toast(err.message,true)}finally{btn.disabled=false}
}

async function saveOrder(ev){ev.preventDefault();try{const partidas=$$('.product-row').map(row=>({cantidad:Number(row.querySelector('.quantity').value),descripcion:row.querySelector('.description').value.trim(),precio_unitario:Number(row.querySelector('.unitprice').value)}));const data={cliente_id:$('#orderClient').value,fecha:$('#orderDate').value,tipo_venta:$('#saleType').value,iva_porcentaje:Number($('#ivaPercent').value)||0,enganche:Number($('#downPayment').value)||0,abono_semanal:Number($('#weeklyPayment').value)||0,observaciones:$('#orderNotes').value,partidas,dispositivo_id:$('#orderDevice').value||null};if(!data.cliente_id)throw Error('Primero selecciona un cliente');if(!partidas.every(p=>p.cantidad>0&&p.descripcion&&p.precio_unitario>=0))throw Error('Revisa cantidades y precios');const button=$('#saveOrder');button.disabled=true;button.textContent='Guardando en Supabase...';try{const res=await api('/api/orden',{method:'POST',body:data});await refresh();go('historico');toast('Orden guardada'+(res.warnings?.length?`. Avisos PDF: ${res.warnings.join('; ')}`:'; PDFs archivados'));await showOrder(res.id)}finally{button.disabled=false;button.textContent='Guardar orden y PDFs'}}catch(err){toast(err.message,true)}}
const options=new Set(['efectivo','transferencia','tarjeta','otro']);
async function showOrder(id){try{const d=await api('/api/orden?id='+encodeURIComponent(id));st.actual=d;const o=d.orden,c=d.cliente,tot=Number(o.total||0),paid=d.abonos.filter(a=>a.estado==='vigente').reduce((n,a)=>n+Number(a.monto),0),bal=Math.max(0,Math.round((tot-paid)*100)/100);$('#detailTitle').textContent=`Orden ${folio(o.folio)}`;$('#detailSubtitle').textContent=`${c.nombre} · ${dateFmt(o.fecha)} · ${o.tipo_venta.toUpperCase()}`;
const activeDocs=[...d.documentos].sort((a,b)=>String(b.fecha_generacion||'').localeCompare(String(a.fecha_generacion||'')) || b.version-a.version);
 const latestStatement=[...d.documentos].filter(doc=>doc.tipo_documento==='estado_cuenta').sort((a,b)=>b.version-a.version)[0];
 const movimientos=historialPagos(o,d.abonos,d.eventos);
 const partidasVisibles=partidasConIva(o,d.partidas);
 const engancheRecibido=d.abonos.filter(a=>a.estado==='vigente'&&a.tipo_pago==='enganche').reduce((n,a)=>n+Number(a.monto||0),0);
$('#detailBody').innerHTML=`<div class="detail-info"><strong>Cliente:</strong> ${e(c.nombre)}<br><strong>Dirección:</strong> ${e(c.direccion||'—')} · ${e(c.ciudad||'—')} · C.P. ${e(c.codigo_postal||'—')}<br><strong>Teléfono:</strong> ${e(c.telefono||'—')} &nbsp; <strong>IMEI:</strong> ${e(d.dispositivo?.imei||'No registrado')}<br><strong>Dispositivo:</strong> ${e(d.dispositivo?.descripcion||'Sin dispositivo asociado')} &nbsp; <strong>RFC:</strong> ${e(c.rfc||'—')}<br><strong>Estado:</strong> ${e(o.estado)} &nbsp; <strong>Enganche:</strong> ${fmt(o.enganche)} &nbsp; <strong>Semanal:</strong> ${fmt(o.abono_semanal)}</div>
<div class="detail-actions" style="justify-content:flex-end;margin:12px 0">${o.estado!=='cancelada'?'<button class="btn btn-outline btn-compact" data-action="edit-expediente">Editar RFC, dispositivo e IMEI</button>':''}</div>
<div class="detail-summary"><div class="detail-stat"><small>VALOR DE LA VENTA</small><strong>${fmt(tot)}</strong></div><div class="detail-stat"><small>TOTAL ABONADO</small><strong>${fmt(paid)}</strong></div><div class="detail-stat"><small>SALDO PENDIENTE</small><strong>${fmt(bal)}</strong></div></div>
<section class="detail-section">
  <h3>Enganche y abono semanal</h3>
  <div class="detail-summary"><div class="detail-stat"><small>ENGANCHE ACORDADO</small><strong>${fmt(o.enganche)}</strong></div><div class="detail-stat"><small>ENGANCHE RECIBIDO</small><strong>${fmt(engancheRecibido)}</strong></div><div class="detail-stat"><small>ABONO POR SEMANA</small><strong>${fmt(o.abono_semanal)}</strong></div></div>
  <p class="muted">El enganche acordado y la cuota semanal son condiciones de la venta. Solo los pagos registrados como recibidos se descuentan del saldo.</p>
  ${o.estado!=='cancelada'?`<form id="conditionsForm" class="detail-form">
    <label>Enganche acordado ($)<input id="editDownPayment" name="enganche" type="number" min="0" max="${tot}" step="0.01" value="${Number(o.enganche||0)}" required></label>
    <label>Abono por semana ($)<input id="editWeeklyPayment" name="abono_semanal" type="number" min="0" step="0.01" value="${Number(o.abono_semanal||0)}" required></label>
    <div class="detail-full"><button type="submit" class="btn btn-primary">Guardar enganche y abono semanal</button></div>
  </form>`:''}
</section>
<section class="detail-section"><h3>Productos y equipos</h3><div class="table-wrap"><table class="detail-table"><thead><tr><th>CANTIDAD</th><th>DESCRIPCIÓN</th><th>PRECIO U. (IVA INCL.)</th><th>IMPORTE (IVA INCL.)</th></tr></thead><tbody>${partidasVisibles.map(p=>`<tr><td>${e(p.cantidad)}</td><td>${e(p.descripcion)}</td><td>${fmt(p.precio_unitario_con_iva)}</td><td>${fmt(p.importe_con_iva)}</td></tr>`).join('')}</tbody></table></div><p class="muted">Subtotal sin IVA: <strong>${fmt(o.subtotal)}</strong> · IVA: <strong>${fmt(o.iva)}</strong> · Total con IVA: <strong>${fmt(o.total)}</strong>. Los precios unitarios se redondean a centavos.</p></section>
<section class="detail-section"><h3>Boleta: pagos y fechas sin pago</h3><p class="muted">Los abonos se muestran por separado, aunque sean varios el mismo día. ACUMULADO es la suma total pagada y se actualiza en el PDF. SIN PAGO no modifica el saldo.</p><div class="table-wrap"><table class="detail-table"><thead><tr><th>FECHA</th><th>MOVIMIENTO EN LA BOLETA</th><th>FECHA COMPROMISO</th><th>ABONO</th><th>ACUMULADO</th><th>SALDO</th></tr></thead><tbody>${movimientos.map(m=>`<tr class="${m.tipo==='sin_pago'?'missed-row':''}"><td>${dateFmt(m.fecha)}</td><td><strong>${e(m.etiqueta)}</strong>${m.referencia?`<div class="muted">${e(m.referencia)}</div>`:''}</td><td>${m.fecha_programada?dateFmt(m.fecha_programada):'—'}</td><td>${m.importe?fmt(m.importe):'—'}</td><td><strong>${fmt(m.acumulado)}</strong></td><td><strong>${fmt(m.saldo)}</strong></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Sin movimientos de pago</td></tr>'}</tbody></table></div></section>
    <section class="detail-section"><h3>Abonos registrados</h3><p class="muted">Puedes anular pagos incorrectos; los registros anulados permanecen en el historial.</p><div class="table-wrap"><table class="detail-table"><thead><tr><th>FECHA REAL</th><th>FECHA PROGRAMADA</th><th>TIPO</th><th>IMPORTE</th><th>ESTADO</th><th></th></tr></thead><tbody>${d.abonos.map(a=>`<tr><td>${dateFmt(a.fecha_pago)}</td><td>${dateFmt(a.fecha_programada)}</td><td>${e(a.tipo_pago)}<div class="muted">${e(a.referencia||'')}</div></td><td><strong>${fmt(a.monto)}</strong></td><td>${e(a.estado)}</td><td>${a.estado==='vigente'&&o.estado!=='cancelada'?`<button class="table-action" data-action="edit-payment" data-id="${e(a.id)}">Editar</button> <button class="table-action" data-action="void-payment" data-id="${e(a.id)}">Anular</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Sin abonos</td></tr>'}</tbody></table></div></section>
${o.estado==='vigente'?`<section class="detail-section"><h3>Registrar pago (en fecha o atrasado)</h3><div class="info-block"><strong>Ejemplo:</strong> debía pagar el 05/12/2026 y lo hizo el 10/12/2026. Registra ambas fechas aquí. GRIPXELL archivará automáticamente <strong>Sin pago 05/diciembre/2026</strong> y <strong>Pago del 10/diciembre/2026</strong>.</div><form id="paymentForm" class="detail-form"><label>Fecha programada (opcional)<input id="payDueDate" type="date"></label><label>Fecha real del pago<input id="payDate" type="date" required value="${today()}"></label><label>Monto recibido<input id="payAmount" type="number" min="0.01" step="0.01" max="${bal}" required placeholder="0.00"></label><label>Tipo de pago<select id="payType"><option value="abono">Abono</option><option value="enganche">Enganche recibido</option></select></label><label>Forma de pago<select id="payMethod"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></label><label class="detail-full">Referencia (opcional)<input id="payRef" maxlength="250" placeholder="Ejemplo: pago correspondiente al 05/12/2026"></label><button class="btn btn-primary detail-full" type="submit">Guardar pago y actualizar boleta PDF</button></form></section><section class="detail-section"><h3>Marcar día sin pago</h3><p class="muted">Si todavía no te ha pagado, registra únicamente el día que debía pagar. No se modifica el saldo. Más adelante podrás registrar el pago real.</p><form id="missedPaymentForm" class="detail-form"><label>Fecha sin pago<input id="missDate" type="date" required value="${today()}"></label><label class="detail-span-two">Observación<input id="missReason" maxlength="180" placeholder="Ejemplo: No pagó la semana"></label><button class="btn btn-outline" type="submit">Guardar SIN PAGO</button></form></section>`:''}
<section class="detail-section"><div class="panel-head"><h3>PDFs y versiones guardadas</h3><div class="detail-actions">${latestStatement?`<button class="btn btn-primary btn-compact" data-action="download-doc" data-id="${e(latestStatement.id)}">Descargar estado actualizado (v${latestStatement.version})</button>`:''}<button class="btn btn-outline btn-compact" data-action="new-pdf" data-kind="nota">Nueva nota PDF</button><button class="btn btn-outline btn-compact" data-action="new-pdf" data-kind="estado_cuenta">Nuevo estado PDF</button></div></div><div class="table-wrap"><table class="detail-table"><thead><tr><th>TIPO</th><th>VERSIÓN</th><th>FECHA</th><th>ACCIONES</th></tr></thead><tbody>${activeDocs.map(doc=>`<tr><td>${doc.tipo_documento==='nota'?'Nota de venta':'Estado de cuenta'}${latestStatement?.id===doc.id?' (más reciente)':''}</td><td>v${doc.version}</td><td>${dateFmt(doc.fecha_generacion)}</td><td><div class="doc-actions"><button class="btn btn-outline" data-action="download-doc" data-id="${e(doc.id)}">PDF</button><button class="btn btn-outline" data-action="share-wa" data-id="${e(doc.id)}">WhatsApp</button><button class="btn btn-outline" data-action="share-email" data-id="${e(doc.id)}">Correo</button></div></td></tr>`).join('')||'<tr><td colspan="4" class="empty">No hay PDFs generados</td></tr>'}</tbody></table></div></section>
<section class="detail-section"><h3>Bitácora de movimientos</h3><div class="table-wrap"><table class="detail-table"><thead><tr><th>FECHA</th><th>MOVIMIENTO</th><th>DESCRIPCIÓN</th></tr></thead><tbody>${d.eventos.slice(0,50).map(v=>`<tr><td>${dateFmt(v.fecha_movimiento)}</td><td>${e(v.tipo_movimiento.replaceAll('_',' '))}</td><td>${e(v.descripcion||'')}</td></tr>`).join('')||'<tr><td colspan="3">Sin movimientos</td></tr>'}</tbody></table></div>${o.estado!=='cancelada'?`<div class="detail-actions" style="justify-content:flex-end;margin-top:15px"><button class="btn btn-danger btn-compact" data-action="cancel-order">Cancelar orden</button></div>`:''}</section>`;
$('#orderDialog').showModal();$('#conditionsForm')?.addEventListener('submit',saveConditions);$('#paymentForm')?.addEventListener('submit',payOrder);$('#missedPaymentForm')?.addEventListener('submit',saveNoPayment);
}catch(err){toast(err.message,true)}}
function editExpediente(){
 const o=st.actual?.orden,c=st.actual?.cliente;
 if(!o||!c)throw Error('Abre una orden antes de editarla');
 if(o.estado==='cancelada')throw Error('No se puede editar una orden cancelada');
 $('#expedienteForm').reset();
 $('#expedienteOrderLabel').textContent='Orden '+folio(o.folio)+' · '+c.nombre;
 $('#expedienteRfc').value=c.rfc||'';
 const equipos=devicesFor(c.id);
 // Se permite visualizar el equipo histórico aunque actualmente esté dado de baja.
 $('#expedienteDevice').innerHTML='<option value="">Sin dispositivo asociado</option>'+equipos.map(d=>
  '<option value="'+e(d.id)+'">'+e(d.descripcion)+' · IMEI '+e(d.imei||'Sin registrar')+(d.estado==='baja'?' (baja)':'')+'</option>'
 ).join('');
 $('#expedienteDevice').value=o.dispositivo_id||'';
 $('#expedienteNewFields').classList.add('hidden');
 $('#expedienteDevice').disabled=false;
 $('#expedienteDescription').required=false;$('#expedienteImei').required=false;
 $('#expedienteToggleNew').textContent='Registrar un celular nuevo e IMEI';
 $('#expedienteDialog').showModal();
}
function toggleNewExpediente(){
 const opening=$('#expedienteNewFields').classList.contains('hidden');
 $('#expedienteNewFields').classList.toggle('hidden',!opening);
 $('#expedienteDevice').disabled=opening;
 $('#expedienteDescription').required=opening;$('#expedienteImei').required=opening;
 $('#expedienteToggleNew').textContent=opening?'Seleccionar un equipo ya registrado':'Registrar un celular nuevo e IMEI';
}
async function saveExpediente(ev){
 ev.preventDefault();
 const o=st.actual?.orden,c=st.actual?.cliente,btn=ev.submitter;
 if(!o||!c)return;
 btn.disabled=true;
 try{
  let dispositivoId=$('#expedienteDevice').value||null;
  if(!$('#expedienteNewFields').classList.contains('hidden')){
   const nuevo=await api('/api/dispositivo',{method:'POST',body:{
    cliente_id:c.id,descripcion:$('#expedienteDescription').value.trim(),
    marca:$('#expedienteBrand').value,modelo:$('#expedienteModel').value,
    imei:$('#expedienteImei').value,precio_venta:Number($('#expedientePrice').value)||0
   }});
   // Si fallara el paso final, el IMEI ya existe: se reintenta seleccionándolo sin duplicar.
   dispositivoId=nuevo.dispositivo.id;
   $('#expedienteDevice').insertAdjacentHTML('beforeend','<option value="'+e(dispositivoId)+'">'+e(nuevo.dispositivo.descripcion)+' · IMEI '+e(nuevo.dispositivo.imei)+'</option>');
   $('#expedienteDevice').value=dispositivoId;
   toggleNewExpediente();
  }
  const res=await api('/api/orden',{method:'PATCH',body:{
   id:o.id,accion:'actualizar_expediente',rfc:$('#expedienteRfc').value,dispositivo_id:dispositivoId
  }});
  $('#expedienteDialog').close();
  await reloadOrder();
  toast(res.sin_cambios?'No había datos por modificar':res.warnings?.length?'Expediente guardado. Avisos: '+res.warnings.join('; '):'RFC, equipo e IMEI guardados. Nuevos PDFs archivados');
 }catch(err){toast(err.message,true)}
 finally{btn.disabled=false}
}
async function reloadOrder(){const id=st.actual?.orden?.id;await refresh();if(id)await showOrder(id)}
async function saveConditions(ev){
 ev.preventDefault();
 const id=st.actual?.orden?.id;if(!id)return;
 const btn=ev.submitter;btn.disabled=true;
 try{
  const x=await api('/api/orden',{method:'PATCH',body:{
   id,accion:'actualizar_condiciones',enganche:Number($('#editDownPayment').value),abono_semanal:Number($('#editWeeklyPayment').value)
  }});
  await reloadOrder();
  toast(x.warnings?.length?'Condiciones guardadas; revisa avisos de PDF: '+x.warnings.join('; '):'Enganche y cuota semanal guardados. Boleta y PDFs actualizados.');
 }catch(err){toast(err.message,true)}finally{btn.disabled=false}
}
function editExistingPayment(id){
 const a=st.actual?.abonos?.find(x=>x.id===id);
 if(!a)throw Error('No se encontró el pago');
 if(a.estado!=='vigente')throw Error('Un pago anulado no se puede editar');
 if(st.actual.orden.estado==='cancelada')throw Error('No puedes modificar pagos de órdenes canceladas');
 $('#editPaymentId').value=a.id;
 $('#editPaymentType').value=a.tipo_pago;
 $('#editPaymentAmount').value=Number(a.monto);
 $('#editPaymentDate').value=a.fecha_pago;
 $('#editPaymentDueDate').value=a.fecha_programada||'';
 $('#editPaymentMethod').value=a.metodo_pago;
 $('#editPaymentReference').value=a.referencia||'';
 $('#editPaymentReason').value='';
 $('#paymentEditDialog').showModal();
}
async function saveExistingPayment(ev){
 ev.preventDefault();
 const button=ev.submitter;
 if(button)button.disabled=true;
 try{
  const body={
   id:$('#editPaymentId').value,accion:'corregir_pago',
   tipo_pago:$('#editPaymentType').value,
   monto:Number($('#editPaymentAmount').value),
   fecha_pago:$('#editPaymentDate').value,
   fecha_programada:$('#editPaymentDueDate').value||null,
   metodo_pago:$('#editPaymentMethod').value,
   referencia:$('#editPaymentReference').value,
   motivo:$('#editPaymentReason').value.trim()
  };
  if(!Number.isFinite(body.monto)||body.monto<=0)throw Error('El importe debe ser mayor a cero');
  if(body.motivo.length<4)throw Error('Escribe el motivo de la corrección (mínimo 4 caracteres)');
  const response=await api('/api/abono',{method:'PATCH',body});
  $('#paymentEditDialog').close();
  await reloadOrder();
  toast(response.warnings?.length?'Pago corregido. Avisos: '+response.warnings.join('; '):'Pago corregido en Supabase, historial y nuevos PDFs guardados');
 }catch(err){toast(err.message,true)}
 finally{if(button)button.disabled=false;}
}
async function payOrder(ev){ev.preventDefault();const id=st.actual?.orden?.id;if(!id)return;const btn=ev.submitter;btn.disabled=true;try{const x=await api('/api/abono',{method:'POST',body:{orden_id:id,fecha_pago:$('#payDate').value,fecha_programada:$('#payDueDate').value||null,monto:Number($('#payAmount').value),tipo_pago:$('#payType').value,metodo_pago:$('#payMethod').value,referencia:$('#payRef').value}});await reloadOrder();toast(x.warning||'Abono registrado en Supabase y nuevo PDF generado')}catch(err){toast(err.message,true)}finally{btn.disabled=false}}
async function saveNoPayment(ev){ev.preventDefault();const id=st.actual?.orden?.id;if(!id)return;const btn=ev.submitter;btn.disabled=true;try{const x=await api('/api/sin-pago',{method:'POST',body:{orden_id:id,fecha:$('#missDate').value,motivo:$('#missReason').value||'Semana sin pago'}});await reloadOrder();toast(x.warning||'Día sin pago guardado en Supabase y PDF actualizado')}catch(err){toast(err.message,true)}finally{btn.disabled=false}}
async function action(act,id,el){try{
 if(act==='detail'){if($('#devicesDialog').open)$('#devicesDialog').close();return showOrder(id);}
 if(act==='new')return newOrder();
 if(act==='client-add')return clientDialog();
 if(act==='admin-open'){go('administracion');$('#adminClientSearch').value='';renderAdminClients();$('#adminClientSelect').value=id;showAdminClient();return}
 if(act==='admin-delete')return await deleteAdminCliente(el.dataset.modo);
 if(act==='client-edit')return clientDialog(st.clientes.find(x=>x.id===id));
 if(act==='client-devices')return showDevices(id);
 if(act==='device-add')return deviceDialog(id);
 if(act==='device-add-selected')return deviceDialog($('#orderClient').value);
 if(act==='order-from-device'){
  const d=deviceFor(id);if(!d)throw Error('Dispositivo no encontrado');
  if($('#devicesDialog').open)$('#devicesDialog').close();
  newOrder();$('#orderClient').value=d.cliente_id;renderDeviceSelect();$('#orderDevice').value=d.id;fillDeviceItem();return;
 }
 if(act==='client-status'){
  const c=clientFor(id);if(!c)throw Error('Cliente no encontrado');
  const estado=c.estado==='baja'?'activo':'baja';
  const escrito=estado==='baja'?prompt('Motivo de baja (no borra órdenes ni abonos):'):'';
  if(escrito===null)return;const motivo=(escrito||'Baja administrativa').trim();
  if(!confirm(`${estado==='baja'?'Dar de baja':'Reactivar'} a ${c.nombre}? Sus documentos históricos se conservan.`))return;
  await api('/api/cliente',{method:'PATCH',body:{id,estado,motivo}});await refresh();toast(`Cliente ${estado==='baja'?'dado de baja':'reactivado'}`);return;
 }
 if(act==='device-toggle'){
  const d=deviceFor(id);if(!d)throw Error('Dispositivo no encontrado');
  const estado=d.estado==='activo'?'baja':'activo';
  if(!confirm(`¿${estado==='baja'?'Dar de baja':'Reactivar'} el dispositivo ${d.descripcion}?`))return;
  await api('/api/dispositivo',{method:'PATCH',body:{id,estado}});
  await refresh();if($('#devicesDialog').open){$('#devicesDialog').close();showDevices(d.cliente_id)}
  toast('Estado del dispositivo actualizado');return;
 }
 if(act==='download-doc'){window.open('/api/documento?id='+encodeURIComponent(id),'_blank','noopener');return;}
 if(['share-wa','share-email'].includes(act)){
  const x=await api('/api/compartir',{method:'POST',body:{id}});
  const msg=`GRIPXELL — Tu documento PDF (${x.expira_en_horas} h de vigencia): ${x.url}`;
  const url=act==='share-wa'?'https://wa.me/?text='+encodeURIComponent(msg):'mailto:?subject='+encodeURIComponent('GRIPXELL - Documento PDF')+'&body='+encodeURIComponent(msg);
  if(act==='share-wa')window.location.assign(url);else window.location.href=url;
  toast('Enlace privado preparado. Confirma el envío en tu aplicación.');return;
 }
 if(act==='new-pdf'){if(!st.actual)return;const x=await api('/api/documento',{method:'POST',body:{orden_id:st.actual.orden.id,tipo:el.dataset.kind}});await reloadOrder();toast(`PDF guardado como versión ${x.documento.version}`);return;}
 if(act==='edit-expediente')return editExpediente();
  if(act==='expediente-toggle-new')return toggleNewExpediente();
  if(act==='edit-payment')return editExistingPayment(id);
 if(act==='void-payment'){const reason=prompt('Indica el motivo de la anulación de este abono:');if(reason===null)return;if(reason.trim().length<4)throw Error('Escribe un motivo de al menos 4 letras');await api('/api/abono',{method:'PATCH',body:{id,motivo:reason}});await reloadOrder();toast('Abono anulado, conservado en histórico');return;}

 if(act==='cancel-order'){if(!confirm('¿Cancelar esta orden? Se conservarán los registros y documentos.'))return;await api('/api/orden',{method:'PATCH',body:{id:st.actual.orden.id,estado:'cancelada'}});await reloadOrder();toast('Orden cancelada. Historial conservado');}
 }catch(err){toast(err.message,true)}}
async function importExcel(){if(!confirm('Importar el folio N°0016 que viene con el Excel original. Solo se hará una vez. ¿Continuar?'))return;try{const a=await api('/api/importar',{method:'POST',body:{confirmar:'IMPORTAR_0016'}});await refresh();toast('Folio N°0016 importado'+(a.warnings?.length?'; revisa los PDFs':''));await showOrder(a.id)}catch(err){toast(err.message,true)}}
function exportData(){const stamp=today();saveCsv(`GRIPXELL_ORDENES_${stamp}.csv`,[['Folio','Fecha','Cliente','Tipo','Total','Abonado','Saldo','Estado'],...st.ordenes.map(o=>[o.folio,o.fecha,nameFor(o.cliente_id),o.tipo_venta,o.total,paymentsFor(o.id),remain(o),o.estado])]);saveCsv(`GRIPXELL_CLIENTES_${stamp}.csv`,[['Nombre','IMEI(s)','Telefono','Direccion','Ciudad','CP','RFC','Estado'],...st.clientes.map(c=>[c.nombre,imeisFor(c.id),c.telefono,c.direccion,c.ciudad,c.codigo_postal,c.rfc,c.estado])]);saveCsv(`GRIPXELL_DISPOSITIVOS_${stamp}.csv`,[['Cliente','Dispositivo','Marca','Modelo','IMEI','Numero serie','Precio','Estado'],...st.dispositivos.map(d=>[nameFor(d.cliente_id),d.descripcion,d.marca,d.modelo,d.imei,d.numero_serie,d.precio_venta,d.estado])]);saveCsv(`GRIPXELL_ABONOS_${stamp}.csv`,[['Folio','Fecha real','Fecha programada','Monto','Tipo','Metodo','Referencia','Estado'],...st.abonos.map(a=>[st.ordenes.find(o=>o.id===a.orden_id)?.folio||'',a.fecha_pago,a.fecha_programada||'',a.monto,a.tipo_pago,a.metodo_pago,a.referencia,a.estado])]);toast('Exportación CSV preparada')}
document.addEventListener('click',ev=>{const nav=ev.target.closest('[data-nav]');if(nav){go(nav.dataset.nav);return}const act=ev.target.closest('[data-action]');if(act){action(act.dataset.action,act.dataset.id,act);return}const close=ev.target.closest('[data-close]');if(close){$('#'+close.dataset.close).close()}});
$('#orderClientSearch').addEventListener('input',renderClientSelector);$('#orderClient').addEventListener('change',renderDeviceSelect);$('#orderDevice').addEventListener('change',fillDeviceItem);
$('#deviceForm').addEventListener('submit',saveDevice);
$('#paymentEditForm').addEventListener('submit',saveExistingPayment);
 $('#expedienteForm').addEventListener('submit',saveExpediente);
$('#addItem').addEventListener('click',()=>addRow());$('#clientForm').addEventListener('submit',saveClient);$('#orderForm').addEventListener('submit',saveOrder);['#ivaPercent','#downPayment','#weeklyPayment','#saleType'].forEach(s=>$(s).addEventListener('input',calc));$('#saleType').addEventListener('change',()=>{if($('#saleType').value==='contado'){$('#weeklyPayment').value=0;calc()}});
$('#searchClients').addEventListener('input',renderClients);$('#searchOrders').addEventListener('input',renderOrders);$('#filterStatus').addEventListener('change',renderOrders);$('#exportCsv').addEventListener('click',exportData);$('#importExcel')?.addEventListener('click',importExcel);
$('#adminClientSearch').addEventListener('input',renderAdminClients);$('#adminClientSelect').addEventListener('change',showAdminClient);
$('#dateNow').textContent=new Intl.DateTimeFormat('es-MX',{dateStyle:'long'}).format(new Date());$('#orderDate').value=today();addRow();connection();
