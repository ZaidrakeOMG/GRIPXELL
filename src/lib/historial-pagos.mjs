/** Movimientos de una boleta: los dias sin pago NO modifican el saldo. */
const centavos = n => Math.round((Number(n) || 0) * 100);
const isoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null;
const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
export function fechaLarga(fecha) {
  const s = isoDate(fecha);
  if (!s) return 'fecha no disponible';
  const [a,m,d] = s.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${meses[m-1]}/${a}`;
}
export function historialPagos(orden, abonos = [], eventos = []) {
  const sinPago = eventos
    .filter(e => e.tipo_movimiento === 'sin_pago')
    .map(e => ({fecha: isoDate(e.datos_nuevos?.fecha), tipo: 'sin_pago', nombre: 'Sin pago', referencia: e.descripcion || '', importe: 0, origen: 'registrado'}))
    .filter(e => e.fecha);
  const yaMarcadas = new Set(sinPago.map(e => e.fecha));
  const movimientos = [...sinPago];
  for (const a of abonos) {
    const fecha = isoDate(a.fecha_pago);
    if (!fecha) continue;
    const programada = isoDate(a.fecha_programada);
    if (a.estado === 'vigente' && programada && programada < fecha && !yaMarcadas.has(programada)) {
      movimientos.push({fecha: programada, tipo: 'sin_pago', nombre: 'Sin pago', referencia: 'No pagó en la fecha acordada', importe: 0, origen: 'calculado'});
      yaMarcadas.add(programada);
    }
    movimientos.push({
      fecha, tipo: a.estado === 'anulado' ? 'anulado' : 'pago',
      nombre: a.estado === 'anulado' ? 'Pago anulado' : a.tipo_pago === 'enganche' ? 'Enganche' : a.tipo_pago === 'liquidacion' ? 'Liquidación' : 'Pago',
      referencia: a.estado === 'anulado' ? (a.motivo_anulacion || '') : (a.referencia || ''),
      importe: a.estado === 'vigente' ? Number(a.monto || 0) : 0,
      montoOriginal: Number(a.monto || 0), fecha_programada: programada, origen: 'abono', id: a.id
    });
  }
  movimientos.sort((a,b) => a.fecha.localeCompare(b.fecha) || ({sin_pago:0, pago:1,anulado:2}[a.tipo] ?? 1) - ({sin_pago:0,pago:1,anulado:2}[b.tipo] ?? 1));
  let saldoCentavos = centavos(orden?.total);
  return movimientos.map((m) => {
    saldoCentavos = Math.max(0,saldoCentavos - centavos(m.importe));
    return {...m, saldo: saldoCentavos / 100, etiqueta: m.tipo==='sin_pago'?`Sin pago ${fechaLarga(m.fecha)}`:`${m.nombre} del ${fechaLarga(m.fecha)}`};
  });
}
