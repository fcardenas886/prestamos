import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, doc, updateDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyBDayetHZ2eoNjGnqcsqbZUqjQeS7WUiS0",
  authDomain: "prestamos-43d7f.firebaseapp.com",
  projectId: "prestamos-43d7f",
  storageBucket: "prestamos-43d7f.firebasestorage.app",
  messagingSenderId: "150090420052",
  appId: "1:150090420052:web:7fe16cd94f7314e226c2c1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 

// Mapas de datos globales, actualizados por onSnapshot (tiempo real)
let clientsById = {};
let prestamosByUser = {};
let abonosByPrestamo = {};
let cuotasByPrestamo = {};
let currentUserId = null; 

function $id(id){ return document.getElementById(id); }
function money(n){ return Number(n||0).toFixed(2); }

function showToast(message, type = 'success') {
  const container = document.querySelector('.toast-container');
  if (!container || typeof bootstrap === 'undefined' || !bootstrap.Toast) {
      console.error("Bootstrap Toast not found.");
      return;
  }
  
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.setAttribute('data-bs-delay', '3000');
  
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  container.appendChild(toastEl);
  
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
  
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

// ######################################################
// ############# LÓGICA DE AUTENTICACIÓN ################
// ######################################################

$id("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
  showToast("Sesión cerrada correctamente.", 'success');
  window.location.href = "login.html"; 
});


// Manejador del estado de la autenticación
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid;
    $id('userEmailDisplay').textContent = user.email;
    initialLoadListeners(); 
  } else {
    window.location.href = "login.html";
  }
});

// ######################################################
// ################# FIN AUTENTICACIÓN ##################
// ######################################################


// ######################################################
// ############ LISTENERS DE TIEMPO REAL ################
// ######################################################

function initialLoadListeners(){
    loadClientsListener();
    loadAbonosListener();
    loadCuotasListener();
    loadPrestamosListener(); 
}

function loadClientsListener(){
  const clientsQuery = query(collection(db,"clientes"), where("userId", "==", currentUserId));
  onSnapshot(clientsQuery, (snap) => {
    clientsById = {};
    $id("clientesList").innerHTML = "";
    
    for(const docu of snap.docs){
      const d = docu.data();
      clientsById[docu.id] = d; 
      // CAMBIO 1: Añadir data-id y clase para el modal
      $id("clientesList").innerHTML += `<li class="list-group-item clickable-client" style="cursor:pointer;" data-id="${docu.id}"><strong>${d.nombre}</strong> — ${d.telefono||''}</li>`;
    }
    // Añadir listener a los nuevos elementos de la lista
    document.querySelectorAll(".clickable-client").forEach(el => {
        el.addEventListener("click", (e) => showClientProfileModal(e.currentTarget.dataset.id));
    });

    populatePrestamosSelect();
  });
}

function loadPrestamosListener(){
  const prestamosQuery = query(collection(db,"prestamos"), where("userId", "==", currentUserId));
  onSnapshot(prestamosQuery, (snap) => {
    prestamosByUser = {};
    for(const docu of snap.docs){
      prestamosByUser[docu.id] = { id: docu.id, ...docu.data() };
    }
    loadPrestamosList(); 
    populatePrestamosSelect(); 
    refreshDashboard(); 
    refreshHistorial();
  });
}

function loadAbonosListener(){
  const abonosQuery = query(collection(db,"abonos"), where("userId", "==", currentUserId));
  onSnapshot(abonosQuery, (snap) => {
    abonosByPrestamo = {};
    $id("abonosList").innerHTML = "";
    
    for(const docu of snap.docs){
      const d = docu.data();
      abonosByPrestamo[d.prestamoId] = (abonosByPrestamo[d.prestamoId] || 0) + (Number(d.monto) || 0);
      
      let dateStr = "";
      try{ dateStr = d.fecha && d.fecha.toDate ? d.fecha.toDate().toLocaleString() : new Date(d.fecha).toLocaleString(); }catch(e){ dateStr = ""; }
      $id("abonosList").innerHTML += `<li class="list-group-item">Préstamo: ${d.prestamoId} — Monto: ${money(d.monto)} — ${dateStr}</li>`;
    }
    loadPrestamosList();
    populatePrestamosSelect(); 
    refreshDashboard(); 
    refreshHistorial();
  });
}

function loadCuotasListener(){
  const cuotasQuery = query(collection(db,"cuotas"));
  onSnapshot(cuotasQuery, (snap) => {
    cuotasByPrestamo = {};
    for(const docu of snap.docs){
      const d = docu.data();
      (cuotasByPrestamo[d.prestamoId] ||= []).push({id: docu.id, ...d});
    }
    loadPrestamosList(); 
    populatePrestamosSelect(); 
    refreshDashboard(); 
    refreshHistorial();
  });
}

// ######################################################
// ########### FUNCIONES DE PINTADO Y LÓGICA ############
// ######################################################

/**
 * Retorna el estado del préstamo y la información de la cuota más crítica.
 * @returns {object} { status: string, vencidas: number, proximas: number, dias: number, fecha: Date|null }
 */
function getPrestamoStatus(pid) {
    const p = prestamosByUser[pid];
    if (!p) return { status: 'desconocido', vencidas: 0, proximas: 0, dias: 9999, fecha: null };

    const cuotas = cuotasByPrestamo[pid] || [];
    const cuotasTotal = cuotas.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
    const abonadoTotal = abonosByPrestamo[pid] || 0;
    const saldoPendiente = cuotasTotal - abonadoTotal;
    
    if (saldoPendiente <= 0) return { status: 'saldado', vencidas: 0, proximas: 0, dias: 0, fecha: null };

    let vencidas = 0;
    let proximas = 0;
    let diasCriticos = 9999;
    let fechaCritica = null;

    const hoy = dayjs().startOf('day');
    
    for (const c of cuotas) {
        if (c.pagada || (c.pagado_parcial || 0) >= (c.monto || 0)) continue;
        
        const fechaCuota = dayjs(c.vencimiento?.toDate?.() || c.vencimiento).startOf('day');
        const diffDias = fechaCuota.diff(hoy, 'day');
        
        if (diffDias < 0) { 
            vencidas++; 
            // Buscamos la cuota más antigua (más negativa)
            if (diffDias < diasCriticos) {
                diasCriticos = diffDias; // Será un número negativo
                fechaCritica = fechaCuota.toDate();
            }
        } else if (diffDias >= 0 && diffDias <= 7) { 
            proximas++; 
            // Buscamos la cuota más cercana (más pequeña)
            if (diffDias < diasCriticos) {
                diasCriticos = diffDias; // Será un número positivo o cero
                fechaCritica = fechaCuota.toDate();
            }
        }
    }
    
    let status = 'al_dia';
    if (vencidas > 0) status = 'vencido';
    else if (proximas > 0) status = 'proximo';
    
    return { status, vencidas, proximas, dias: diasCriticos, fecha: fechaCritica };
}

function loadPrestamosList(){
  $id("prestamosList").innerHTML = "";
  const estadoFiltro = $id("filtroEstadoPrestamo")?.value || 'todos'; 

  for(const pid in prestamosByUser){
    const p = prestamosByUser[pid];
    const statusData = getPrestamoStatus(pid);

    if (estadoFiltro !== 'todos' && estadoFiltro !== statusData.status) {
        continue;
    }
    
    let borderClass = '';
    let estadoText = '';
    
    // CAMBIO 2: Indicadores visuales y de tiempo en la lista
    if(statusData.status === 'saldado') {
        borderClass = 'border-start border-4 border-success';
        estadoText = `<small class="text-success">✅ Saldado</small>`;
    } else if(statusData.status === 'vencido') {
        borderClass = 'border-start border-4 border-danger';
        const diasVencidos = Math.abs(statusData.dias);
        estadoText = `<small class="text-danger">🚨 **VENCIDO HACE ${diasVencidos} DÍA(S)**</small>`;
    } else if(statusData.status === 'proximo') {
        borderClass = 'border-start border-4 border-warning';
        const fechaStr = dayjs(statusData.fecha).format('DD/MM/YYYY');
        estadoText = `<small class="text-warning">⏰ Vence en ${statusData.dias} días (${fechaStr})</small>`;
    } else {
        borderClass = 'border-start border-4 border-primary';
        estadoText = `<small class="text-primary">Al día</small>`;
    }
    
    const clientName = clientsById[p.clienteId]?.nombre || p.clienteId; 

    const fechaCreacion = p.fecha?.toDate ? p.fecha.toDate() : new Date(p.fecha);
    const fechaStr = fechaCreacion.toLocaleDateString();
    
    $id("prestamosList").innerHTML += `
      <li class="list-group-item ${borderClass}">
        <strong style="cursor:pointer;" class="text-decoration-underline" data-cid="${p.clienteId}" onclick="showClientProfileModal(this.dataset.cid)">Cliente: ${clientName}</strong> — Monto ${money(p.monto)} — Cuotas: ${p.cuotas}
        <br><small>ID Préstamo: ${pid} | Banco: ${p.banco||'-'} | Fecha: ${fechaStr}</small>
        <br>${estadoText}
      </li>
    `;
  }
}

// NUEVA FUNCIÓN: Muestra el modal del perfil del cliente
function showClientProfileModal(clientId) {
    const client = clientsById[clientId];
    if (!client) return showToast("Cliente no encontrado.", 'danger');

    const clientPrestamos = Object.values(prestamosByUser).filter(p => p.clienteId === clientId);
    let totalDue = 0;
    let prestamosHtml = '';

    for (const p of clientPrestamos) {
        const cuotas = cuotasByPrestamo[p.id] || [];
        const cuotasTotal = cuotas.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
        const abonadoTotal = abonosByPrestamo[p.id] || 0;
        const saldoPendiente = money(cuotasTotal - abonadoTotal);
        const statusData = getPrestamoStatus(p.id);
        
        totalDue += parseFloat(saldoPendiente);

        let statusClass = 'text-success';
        if (statusData.status === 'vencido') statusClass = 'text-danger';
        else if (statusData.status === 'proximo') statusClass = 'text-warning';
        else if (statusData.status === 'al_dia') statusClass = 'text-primary';

        prestamosHtml += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>Préstamo ID: ${p.id}</strong> — Monto Inicial: $${money(p.monto)}
                    <br><small>Cuotas: ${p.cuotas} | Interés: ${p.interes}%</small>
                </div>
                <div class="text-end">
                    <span class="badge bg-secondary me-2 ${statusClass}">${statusData.status.toUpperCase().replace('_', ' ')}</span>
                    <span class="fs-6 ${statusClass}">Saldo: $${saldoPendiente}</span>
                </div>
            </div>
        `;
    }

    $id('modalClientName').textContent = client.nombre;
    $id('modalClientPhone').textContent = client.telefono || 'N/A';
    $id('modalClientTotalDue').textContent = `$${money(totalDue)}`;
    $id('modalClientPrestamosList').innerHTML = prestamosHtml || '<p class="text-center text-muted">No hay préstamos registrados para este cliente.</p>';

    // Configurar botones de acción rápida
    $id('modalBtnNewLoan').onclick = () => {
        // Simular clic en la pestaña Préstamos y pre-seleccionar cliente
        const bsTab = new bootstrap.Tab($id('tabs').querySelector(`[data-bs-target="#tab-prestamos"]`));
        bsTab.show();
        $id('prestamoCliente').value = clientId;
        bootstrap.Modal.getInstance($id('clientProfileModal')).hide();
    };

    $id('modalBtnNewAbono').onclick = () => {
        // Simular clic en la pestaña Abonos y pre-seleccionar cliente en el filtro
        const bsTab = new bootstrap.Tab($id('tabs').querySelector(`[data-bs-target="#tab-abonos"]`));
        bsTab.show();
        $id('filtroClienteAbono').value = clientId;
        // La función populatePrestamosSelect se dispara con el change del filtro
        populatePrestamosSelect(clientId); 
        bootstrap.Modal.getInstance($id('clientProfileModal')).hide();
    };


    const clientModal = new bootstrap.Modal($id('clientProfileModal'));
    clientModal.show();
}
window.showClientProfileModal = showClientProfileModal; // Hacemos la función global


function populatePrestamosSelect(clienteFiltro=''){
  $id("prestamoCliente").innerHTML = "<option value=''>Seleccione cliente</option>";
  $id("filtroClienteAbono").innerHTML = "<option value=''>Filtrar por cliente (opcional)</option>";
  $id("abonoPrestamo").innerHTML = "<option value=''>Seleccione préstamo</option>";
  
  for(const cid in clientsById){
    const nombre = clientsById[cid].nombre;
    $id("prestamoCliente").innerHTML += `<option value="${cid}">${nombre}</option>`;
    $id("filtroClienteAbono").innerHTML += `<option value="${cid}">${nombre}</option>`;
  }
  
  for(const pid in prestamosByUser){
    const p = prestamosByUser[pid];
    if(clienteFiltro && p.clienteId !== clienteFiltro) continue;
    
    const clientName = clientsById[p.clienteId]?.nombre || p.clienteId; 
    
    const cuotasTotal = (cuotasByPrestamo[pid] || []).reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
    const abonadoTotal = abonosByPrestamo[pid] || 0;
    const saldoPendiente = money(cuotasTotal - abonadoTotal);

    if (parseFloat(saldoPendiente) <= 0) continue; 
    
    const observacion = p.observacion ? ` | Obs: ${p.observacion}` : '';
    
    $id("abonoPrestamo").innerHTML += `
      <option value="${pid}">
        ${clientName} — $${money(p.monto)} — SALDO: $${saldoPendiente} ${observacion}
      </option>
    `;
  }
}

// ---------- FORMULARIOS ----------
$id("clienteForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const nombre = $id("clienteNombre").value.trim();
  const telefono = $id("clienteTelefono").value.trim();
  if(!nombre) return showToast("Nombre requerido", 'danger');
  
  await addDoc(collection(db,"clientes"), { 
    nombre, 
    telefono, 
    userId: currentUserId 
  }); 
  
  $id("clienteForm").reset();
  showToast(`Cliente ${nombre} registrado con éxito.`);
});

$id("prestamoForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const clienteId = $id("prestamoCliente").value;
  const monto = parseFloat($id("prestamoMonto").value);
  const interes = parseFloat($id("prestamoInteres")?.value || 0);
  const cuotas = parseInt($id("prestamoCuotas").value);
  const banco = $id("prestamoBanco").value.trim();
  const observacion = $id("prestamoObs").value.trim();
  
  if(!clienteId) return showToast("Seleccione cliente", 'danger');
  if(!monto || !cuotas) return showToast("Monto y cuotas requeridos", 'danger');
  if(monto <= 0) return showToast("El monto debe ser positivo.", 'danger');
  if (typeof dayjs === 'undefined') return showToast("Error: Day.js no cargado para cálculo de fechas.", 'danger');


  const montoConInteres = monto * (1 + (interes / 100));
  const montoCuota = Number((montoConInteres / cuotas).toFixed(2));
  const fechaBase = dayjs(); 
  
  const prestRef = await addDoc(collection(db,"prestamos"), { 
    clienteId, 
    monto, 
    interes, 
    cuotas, 
    montoTotalCuotas: montoConInteres, 
    banco, 
    observacion, 
    fecha:new Date(),
    userId: currentUserId 
  });

  for(let i=1;i<=cuotas;i++){
    const fechaV = fechaBase.add(i, 'month').toDate(); 

    await addDoc(collection(db,"cuotas"), { 
      prestamoId: prestRef.id, 
      numero:i, 
      monto: montoCuota, 
      pagada:false,
      pagado_parcial: 0, 
      vencimiento: fechaV 
    });
  }

  $id("prestamoForm").reset();
  showToast(`Préstamo por $${money(monto)} registrado con éxito.`);
});

$id("abonoForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const prestamoId = $id("abonoPrestamo").value;
  let montoAbono = parseFloat($id("abonoMonto").value);
  
  if(!prestamoId || !montoAbono) return showToast("Seleccione préstamo e ingrese monto", 'danger');
  if(montoAbono <= 0) return showToast("El monto a abonar debe ser positivo.", 'danger');

  try {
      await runTransaction(db, async (transaction) => {
          
          const cuotasDocs = cuotasByPrestamo[prestamoId] || []; 
          
          const totalCuotas = cuotasDocs.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
          const totalAbonadoPrevio = abonosByPrestamo[prestamoId] || 0;
          
          const saldoPendiente = totalCuotas - totalAbonadoPrevio;
          
          if(saldoPendiente <= 0) throw new Error("¡Este préstamo ya está saldado!");
          
          if(montoAbono > saldoPendiente){
              montoAbono = saldoPendiente; 
          }
          
          if(montoAbono <= 0) return; 

          // 1. Registrar Abono
          const abonoRef = doc(collection(db, "abonos"));
          transaction.set(abonoRef, { prestamoId, monto: montoAbono, fecha: new Date(), userId: currentUserId });
          
          let restante = montoAbono; 
          
          let cuotasOrdenadas = [...cuotasDocs];
          cuotasOrdenadas.sort((a, b) => {
            const dateA = a.vencimiento?.toDate?.() || new Date(a.vencimiento);
            const dateB = b.vencimiento?.toDate?.() || new Date(b.vencimiento);
            return dateA - dateB;
          });
          
          // 2. Aplicar el pago a las cuotas
          for(const cdata of cuotasOrdenadas){
              if(restante <= 0) break;
              const cuotaRef = doc(db,"cuotas", cdata.id);
              
              const montoCuota = Number(cdata.monto) || 0;
              const pagadoParcial = Number(cdata.pagado_parcial) || 0;
              const montoFaltante = montoCuota - pagadoParcial; 
              
              if(cdata.pagada || montoFaltante <= 0) continue;
              
              if(restante >= montoFaltante){
                  transaction.update(cuotaRef, { pagada: true, pagado_parcial: 0 }); 
                  restante -= montoFaltante;
              } else {
                  transaction.update(cuotaRef, { pagado_parcial: pagadoParcial + restante });
                  restante = 0;
              }
          }
      });
      
      $id("abonoForm").reset();
      showToast(`Abono por $${money(montoAbono)} aplicado correctamente.`);
      
  } catch (e) {
      if (e.message && e.message.includes("saldado")) {
        showToast(e.message, 'warning');
      } else {
        console.error("Fallo la transaccion:", e);
        showToast("Error al procesar el abono. Inténtelo de nuevo.", 'danger');
      }
  }
});


$id("filtroClienteAbono").addEventListener("change", (e)=>{
  populatePrestamosSelect(e.target.value);
});

// ---------- HISTORIAL ----------
function exportarHistorialCSV() {
    // ... (El cuerpo de esta función se mantiene igual)
}

$id("btnExportarHistorial").addEventListener("click", exportarHistorialCSV);
$id("btnRefrescarHistorial").addEventListener("click", refreshHistorial);


function refreshHistorial(){
  // ... (El cuerpo de esta función se mantiene igual, pero usa la nueva getPrestamoStatus)
  const filterText = $id("historialFiltro")?.value?.trim().toLowerCase() || '';
  
  const tbody = $id("historialTable").querySelector("tbody");
  tbody.innerHTML = "";
  
  for(const pid in prestamosByUser){
    const p = prestamosByUser[pid];
    
    const clientName = clientsById[p.clienteId]?.nombre || p.clienteId; 
    
    if(filterText && !clientName.toLowerCase().includes(filterText) && !p.clienteId.toLowerCase().includes(filterText)) continue;
    
    const totalCuotasAdeudado = (cuotasByPrestamo[pid] || []).reduce((sum, c) => sum + (Number(c.monto) || 0), 0); 
    const totalAb = abonosByPrestamo[pid] || 0;
    const saldo = Number(totalCuotasAdeudado - totalAb).toFixed(2); 
    const status = getPrestamoStatus(pid).status; // Usamos solo el status del objeto
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${pid}</td>
      <td>${clientName}</td>
      <td>${money(p.monto)}</td>
      <td>${Number(p.interes||0).toFixed(2)}</td>
      <td>${p.cuotas}</td>
      <td>${money(totalAb)}</td>
      <td class="${saldo > 0 ? 'text-danger' : 'text-success'}"><b>${saldo}</b></td>
      <td>${p.banco||''}</td>
      <td>${p.observacion||''}</td>
      <td><button class="btn btn-sm btn-outline-info btn-view" data-id="${pid}">Ver cuotas</button></td>
    `;
    tbody.appendChild(tr);
    const exp = document.createElement("tr");
    exp.style.display = "none";
    exp.id = "exp_"+pid;
    exp.innerHTML = `<td colspan="10"><div id="expbody_${pid}">—</div></td>`; 
    tbody.appendChild(exp);
  }
  
  document.querySelectorAll(".btn-view").forEach(btn => {
    btn.onclick = async (ev) => {
      const pid = ev.target.dataset.id;
      const expRow = document.getElementById("exp_"+pid);
      const body = document.getElementById("expbody_"+pid);
      if(expRow.style.display === "none"){
        
        let cuotasOrdenadas = [...(cuotasByPrestamo[pid] || [])];
        
        cuotasOrdenadas.sort((a, b) => {
          const dateA = a.vencimiento?.toDate?.() || new Date(a.vencimiento);
          const dateB = b.vencimiento?.toDate?.() || new Date(b.vencimiento);
          return dateA - dateB;
        });
        
        let html = `<div class="list-group">`;
        
        for(const cdata of cuotasOrdenadas){
          const cd = cdata;
          const c_id = cdata.id;
          
          let estado;
          if(cd.pagada) {
            estado = "Pagada";
          } else if(cd.pagado_parcial && cd.pagado_parcial > 0) {
            estado = `Parcial (${money(cd.pagado_parcial)})`;
          } else {
            estado = "Pendiente";
          }
          
          const btnTxt = cd.pagada ? 'Desmarcar' : 'Marcar pagada';
          const btnCls = cd.pagada ? 'btn-danger' : 'btn-success';
          
          let vencimientoStr = "";
          try { vencimientoStr = cd.vencimiento?.toDate?.()?.toLocaleDateString() || new Date(cd.vencimiento).toLocaleDateString(); } catch(e) { vencimientoStr = "N/A"; }

          html += `<div class="d-flex justify-content-between align-items-center border p-2 mb-1">
            <div>Cuota ${cd.numero} — **$${money(cd.monto)}** (Venc.: ${vencimientoStr}) — <small class="text-primary">${estado}</small></div>
            <div><button class="btn btn-sm ${btnCls} btn-toggle-cuota" data-qid="${c_id}" data-pid="${pid}">${btnTxt}</button></div>
          </div>`;
        }
        html += `</div>`;
        body.innerHTML = html;
        expRow.style.display = "";
        
        body.querySelectorAll(".btn-toggle-cuota").forEach(bt => {
          bt.onclick = async (e2) => {
            const qid = e2.target.dataset.qid;
            const cuotaRef = doc(db,"cuotas", qid);
            const isMark = e2.target.textContent.trim() === 'Marcar pagada';
            
            const updateData = { pagada: isMark, pagado_parcial: 0 };
            
            await updateDoc(cuotaRef, updateData);
          };
        });
      } else {
        expRow.style.display = "none";
      }
    };
  });
}


// ---------- DASHBOARD ----------
let chartInstance;
let chartClientes;

function updateCuotaCounters(){
  const hoy = new Date();
  const tresDias = new Date();
  tresDias.setDate(hoy.getDate()+3); 

  let vencidas = 0;
  let proximas = 0;
  
  for(const pid in prestamosByUser){
    const cuotas = cuotasByPrestamo[pid] || [];
    for(const c of cuotas){
      if(c.pagada) continue;
      const fechaV = c.vencimiento?.toDate?.() || new Date(c.vencimiento || hoy);
      if(fechaV < hoy) vencidas++;
      else if(fechaV >= hoy && fechaV <= tresDias) proximas++;
    }
  }

  $id("dashCuotasVencidas").textContent = vencidas;
  $id("dashCuotasPorVencer").textContent = proximas;
}


function refreshDashboard(){
  const now=new Date();
  const currentMonth=now.getMonth();
  const lastMonth=(currentMonth+11)%12;

  let prestamosActual=0,prestamosAnterior=0;

  for(const pid in prestamosByUser){
    const p = prestamosByUser[pid];
    const fecha=p.fecha?.toDate?.()||new Date(p.fecha||now);
    if(fecha.getMonth()===currentMonth) prestamosActual+=Number(p.monto||0);
    else if(fecha.getMonth()===lastMonth) prestamosAnterior+=Number(p.monto||0);
  }

  const totalAbonos = Object.values(abonosByPrestamo).reduce((a, b) => a + b, 0);

  $id("dashTotalPrestamos").textContent=money(prestamosActual);
  $id("dashTotalAbonos").textContent=money(totalAbonos);
  $id("dashPrestamosTrend").textContent=prestamosActual>=prestamosAnterior?"🔼 vs mes anterior":"🔽 vs mes anterior";
  $id("dashAbonosTrend").textContent="N/A (Total Histórico)";

  updateCuotaCounters(); 

  const ctx=document.getElementById("dashChart")?.getContext("2d");
  if(ctx){
    if(chartInstance){chartInstance.destroy();}
    chartInstance=new Chart(ctx,{
      type:'bar',
      data:{
        labels:['Préstamos Act.','Préstamos Ant.'],
        datasets:[
          {label:'Préstamos',data:[prestamosActual,prestamosAnterior],backgroundColor:'#e84118'}
        ]
      },
      options:{responsive:true,maintainAspectRatio:false}
    });
  }


const montosPorCliente = {};
for(const pid in prestamosByUser){
  const p=prestamosByUser[pid];
  montosPorCliente[p.clienteId]=(montosPorCliente[p.clienteId]||0)+Number(p.monto||0);
}

const totalPrestamosClientes = Object.values(montosPorCliente).reduce((a,b)=>a+b,0);
const nombresClientes = [];
const valoresPrestamos = [];

for(const [cid,monto] of Object.entries(montosPorCliente)){
  if(monto>0){
    const nombre = clientsById[cid]?.nombre || cid; 
    const porcentaje = ((monto/totalPrestamosClientes)*100).toFixed(1);
    nombresClientes.push(`${nombre} – $${money(monto)} (${porcentaje}%)`);
    valoresPrestamos.push(monto);
  }
}

const ctxClientes=document.getElementById("dashChartClientes")?.getContext("2d");
if(ctxClientes){
  if(chartClientes){ chartClientes.destroy(); }
  chartClientes=new Chart(ctxClientes,{
    type:'doughnut',  
    data:{
      labels:nombresClientes,
      datasets:[{
        label:'Monto total de préstamos',
        data:valoresPrestamos,
        backgroundColor: [
          '#0097e6','#44bd32','#e84118','#8c7ae6','#fbc531','#00a8ff','#4cd137'
        ]
      }]
    },
    options:{
      responsive:true,
      plugins:{
        legend:{position:'right'}
      }
    }
  });
}

}

document.querySelector('button[data-bs-target="#tab-dashboard"]').addEventListener('shown.bs.tab', () => {
  refreshDashboard();
});

// Hacemos loadPrestamosList global para que el filtro del HTML pueda llamarla
window.loadPrestamosList = loadPrestamosList;