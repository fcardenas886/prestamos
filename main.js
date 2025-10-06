import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, doc, updateDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

// Config Firebase
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

// Globals
let clientsById = {};
let prestamosByUser = {};
let abonosByPrestamo = {};
let cuotasByPrestamo = {};
let currentUserId = null;
let abonosList = [];

function $id(id){ return document.getElementById(id); }
function money(n){
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 2
    }).format(Number(n||0));
}

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
    toastEl.addEventListener('hidden.bs.toast', () => { toastEl.remove(); });
}

// Auth
$id("btnLogout")?.addEventListener("click", async () => {
    try {
        await signOut(auth);
        showToast("Sesión cerrada correctamente.", 'success');
        window.location.href = "login.html";
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        showToast("No se pudo cerrar la sesión.", 'danger');
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        $id('userEmailDisplay').textContent = user.email;
        initialLoadListeners();
    } else {
        window.location.href = "login.html";
    }
});

// Listeners realtime
function initialLoadListeners(){
    loadClientsListener();
    loadAbonosListener();
    loadCuotasListener();
    loadPrestamosListener();
}

function loadClientsListener(){
    const q = query(collection(db,"clientes"), where("userId","==",currentUserId));
    onSnapshot(q, snap => {
        clientsById = {};
        snap.forEach(d => clientsById[d.id] = d.data());
        renderClientList();
        renderAllAppComponents();
    }, err => console.error("clients listener:", err));
}

function loadPrestamosListener(){
    const q = query(collection(db,"prestamos"), where("userId","==",currentUserId));
    onSnapshot(q, snap => {
        prestamosByUser = {};
        snap.forEach(d => prestamosByUser[d.id] = {id:d.id, ...d.data()});
        renderAllAppComponents();
    }, err => console.error("prestamos listener:", err));
}

function loadAbonosListener(){
    const q = query(collection(db,"abonos"), where("userId","==",currentUserId));
    onSnapshot(q, snap => {
        abonosByPrestamo = {};
        abonosList = [];
        for (const docu of snap.docs) {
            const d = { id: docu.id, ...docu.data() };
            abonosList.push(d);
            abonosByPrestamo[d.prestamoId] = (abonosByPrestamo[d.prestamoId] || 0) + (Number(d.monto)||0);
        }
        abonosList.sort((a,b)=>{
            const fa = a.fecha?.toDate?.()||new Date(a.fecha);
            const fb = b.fecha?.toDate?.()||new Date(b.fecha);
            return fb-fa;
        });
        renderAllAppComponents();
        renderUltimosAbonos();
    }, err => console.error("abonos listener:", err));
}

function loadCuotasListener(){
    const q = query(collection(db,"cuotas"));
    onSnapshot(q, snap => {
        cuotasByPrestamo = {};
        snap.forEach(d=>{
            const data = d.data();
            (cuotasByPrestamo[data.prestamoId] ||= []).push({id:d.id,...data});
        });
        renderAllAppComponents();
    }, err => console.error("cuotas listener:", err));
}

// Render core
function renderAllAppComponents(){
    loadPrestamosList();
    populatePrestamosSelect();
    refreshDashboard();
    refreshHistorial();
}

// CLIENTES
function renderClientList(){
    const list = $id("clientesList");
    if(!list) return;
    list.innerHTML = "";
    const ids = Object.keys(clientsById);
    if(ids.length===0){
        list.innerHTML = '<li class="list-group-item text-center text-muted">No hay clientes registrados.</li>';
        return;
    }
    for(const cid of ids){
        const d = clientsById[cid];
        const li = document.createElement('li');
        li.className = "list-group-item clickable-client";
        li.dataset.id = cid;
        li.style.cursor = "pointer";
        li.innerHTML = `<strong>${d.nombre}</strong> — ${d.telefono||''}`;
        li.addEventListener("click", ()=>showClientProfileModal(cid));
        list.appendChild(li);
    }
}

// PRESTAMOS LIST
function loadPrestamosList(){
    $id("prestamosList").innerHTML = "";
    const estadoFiltro = $id("filtroEstadoPrestamo")?.value || 'todos';
    for(const pid in prestamosByUser){
        const p = prestamosByUser[pid];
        const statusData = getPrestamoStatus(pid);
        if (estadoFiltro !== 'todos' && estadoFiltro !== statusData.status) continue;

        let borderClass = '';
        let estadoText = '';
        if(statusData.status === 'saldado') {
            borderClass = 'border-start border-4 border-success';
            estadoText = `<small class="text-success">✅ Saldado</small>`;
        } else if(statusData.status === 'vencido') {
            borderClass = 'border-start border-4 border-danger';
            const diasVencidos = Math.abs(statusData.dias);
            estadoText = `<small class="text-danger">🚨 VENCIDO HACE ${diasVencidos} DÍA(S)</small>`;
        } else if(statusData.status === 'proximo') {
            borderClass = 'border-start border-4 border-warning';
            const fechaStr = dayjs(statusData.fecha).format('DD/MM/YYYY');
            estadoText = `<small class="text-warning">⏰ Vence en ${statusData.dias} días (${fechaStr})</small>`;
        } else {
            borderClass = 'border-start border-4 border-primary';
            estadoText = `<small class="text-primary">Al día</small>`;
        }

        const clientName = clientsById[p.clienteId]?.nombre || p.clienteId;
        const fechaCreacion = p.fecha?.toDate ? p.fecha.toDate() : new Date(p.fecha || Date.now());
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

// GET PRESTAMO STATUS
function getPrestamoStatus(pid) {
    const p = prestamosByUser[pid];
    if (!p) return { status: 'desconocido', vencidas: 0, proximas: 0, dias: 9999, fecha: null };
    const cuotas = cuotasByPrestamo[pid] || [];
    const cuotasTotal = cuotas.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
    const abonadoTotal = abonosByPrestamo[pid] || 0;
    const saldoPendiente = cuotasTotal - abonadoTotal;
    if (saldoPendiente <= 0) return { status: 'saldado', vencidas: 0, proximas: 0, dias: 0, fecha: null };

    let vencidas = 0, proximas = 0, diasCriticos = 9999, fechaCritica = null;
    const hoy = dayjs().startOf('day');
    for (const c of cuotas) {
        if (c.pagada || (c.pagado_parcial || 0) >= (c.monto || 0)) continue;
        const fechaCuota = dayjs(c.vencimiento?.toDate?.() || c.vencimiento).startOf('day');
        const diffDias = fechaCuota.diff(hoy, 'day');
        if (diffDias < 0) {
            vencidas++;
            if (diffDias < diasCriticos) { diasCriticos = diffDias; fechaCritica = fechaCuota.toDate(); }
        } else if (diffDias >= 0 && diffDias <= 7) {
            proximas++;
            if (diffDias < diasCriticos) { diasCriticos = diffDias; fechaCritica = fechaCuota.toDate(); }
        }
    }
    let status = 'al_dia';
    if (vencidas > 0) status = 'vencido';
    else if (proximas > 0) status = 'proximo';
    return { status, vencidas, proximas, dias: diasCriticos, fecha: fechaCritica };
}

// SHOW CLIENT PROFILE (MODAL EXISTENTE)
function showClientProfileModal(clientId) {
    const client = clientsById[clientId];
    if (!client) return showToast("Cliente no encontrado.", 'danger');
    const clientPrestamos = Object.values(prestamosByUser).filter(p => p.clienteId === clientId);
    let totalDue = 0, prestamosHtml = '';
    for (const p of clientPrestamos) {
        const cuotas = cuotasByPrestamo[p.id] || [];
        const cuotasTotal = cuotas.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
        const abonadoTotal = abonosByPrestamo[p.id] || 0;
        const saldoPendiente = cuotasTotal - abonadoTotal;
        const statusData = getPrestamoStatus(p.id);
        totalDue += saldoPendiente;
        let statusClass = 'text-success';
        if (statusData.status === 'vencido') statusClass = 'text-danger';
        else if (statusData.status === 'proximo') statusClass = 'text-warning';
        prestamosHtml += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>Préstamo ID: ${p.id}</strong> — Monto Inicial: ${money(p.monto)}
                    <br><small>Cuotas: ${p.cuotas} | Interés: ${p.interes}%</small>
                </div>
                <div class="text-end">
                    <span class="badge bg-secondary me-2 ${statusClass}">${statusData.status.toUpperCase().replace('_', ' ')}</span>
                    <span class="fs-6 ${statusClass}">Saldo: ${money(saldoPendiente)}</span>
                </div>
            </div>
        `;
    }
    $id('modalClientName').textContent = client.nombre;
    $id('modalClientPhone').textContent = client.telefono || 'N/A';
    $id('modalClientTotalDue').textContent = money(totalDue);
    $id('modalClientPrestamosList').innerHTML = prestamosHtml || '<p class="text-center text-muted">No hay préstamos registrados para este cliente.</p>';

    $id('modalBtnNewLoan').onclick = () => {
        const bsTab = new bootstrap.Tab($id('tabs').querySelector(`[data-bs-target="#tab-prestamos"]`));
        bsTab.show();
        $id('prestamoCliente').value = clientId;
        bootstrap.Modal.getInstance($id('clientProfileModal'))?.hide();
    };
    $id('modalBtnNewAbono').onclick = () => {
        const bsTab = new bootstrap.Tab($id('tabs').querySelector(`[data-bs-target="#tab-abonos"]`));
        bsTab.show();
        $id('filtroClienteAbono').value = clientId;
        populatePrestamosSelect(clientId);
        bootstrap.Modal.getInstance($id('clientProfileModal'))?.hide();
    };
    const clientModal = new bootstrap.Modal($id('clientProfileModal'));
    clientModal.show();
}
window.showClientProfileModal = showClientProfileModal;

// POPULATE PRESTAMOS SELECT (incluye abonoPrestamo)
function populatePrestamosSelect(clienteFiltro=''){
    $id("prestamoCliente").innerHTML = "<option value=''>Seleccione cliente</option>";
    $id("filtroClienteAbono").innerHTML = "<option value=''>Filtrar por cliente (opcional)</option>";
    $id("abonoPrestamo").innerHTML = "<option value=''>Seleccione préstamo</option>";
    for(const cid in clientsById){
        const nombre = clientsById[cid].nombre;
        $id("prestamoCliente").innerHTML += `<option value="${cid}">${nombre}</option>`;
        const isSelected = clienteFiltro === cid ? 'selected' : '';
        $id("filtroClienteAbono").innerHTML += `<option value="${cid}" ${isSelected}>${nombre}</option>`;
    }
    for(const pid in prestamosByUser){
        const p = prestamosByUser[pid];
        if(clienteFiltro && p.clienteId !== clienteFiltro) continue;
        const clientName = clientsById[p.clienteId]?.nombre || p.clienteId;
        const cuotasTotal = (cuotasByPrestamo[pid] || []).reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
        const abonadoTotal = abonosByPrestamo[pid] || 0;
        const saldoPendiente = cuotasTotal - abonadoTotal;
        if (saldoPendiente <= 0) continue;
        const observacion = p.observacion ? ` | Obs: ${p.observacion}` : '';
        // Obtener próxima cuota para mostrar en info al seleccionar (no en option)
        $id("abonoPrestamo").innerHTML += `
            <option value="${pid}">
            ${clientName} — ${money(p.monto)} — SALDO: ${money(saldoPendiente)} ${observacion}
            </option>
        `;
    }
}

// FORM: CLIENTE
$id("clienteForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const nombre = $id("clienteNombre").value.trim();
    const telefono = $id("clienteTelefono").value.trim();
    if(!nombre) return showToast("Nombre requerido", 'danger');
    try {
        await addDoc(collection(db,"clientes"), { nombre, telefono, userId: currentUserId, createdAt: new Date() });
        $id("clienteForm").reset();
        showToast(`Cliente ${nombre} registrado con éxito.`);
        bootstrap.Modal.getInstance($id('newClientModal'))?.hide();
    } catch (error) {
        console.error("Error al registrar cliente:", error);
        showToast("Error al guardar cliente. Revisa la consola.", 'danger');
    }
});

// FORM: PRESTAMO
$id("prestamoForm")?.addEventListener("submit", async (e)=>{
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
    try {
        const prestRef = await addDoc(collection(db,"prestamos"), { clienteId, monto, interes, cuotas, montoTotalCuotas: montoConInteres, banco, observacion, fecha: new Date(), userId: currentUserId });
        const cuotasBatch = [];
        for(let i=1;i<=cuotas;i++){
            const fechaV = fechaBase.add(i, 'month').toDate();
            cuotasBatch.push(addDoc(collection(db,"cuotas"), { prestamoId: prestRef.id, numero:i, monto: montoCuota, pagada:false, pagado_parcial: 0, vencimiento: fechaV }));
        }
        await Promise.all(cuotasBatch);
        $id("prestamoForm").reset();
        showToast(`Préstamo por ${money(monto)} registrado con éxito.`);
    } catch (error) {
        console.error("Error al registrar préstamo:", error);
        showToast("Error al registrar préstamo. Revisa la consola.", 'danger');
    }
});

// FORM: ABONO
$id("abonoForm")?.addEventListener("submit", async (e)=>{
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
            if(montoAbono > saldoPendiente) montoAbono = saldoPendiente;
            if(montoAbono <= 0) return;
            const abonoRef = doc(collection(db, "abonos"));
            transaction.set(abonoRef, { prestamoId, monto: montoAbono, fecha: new Date(), userId: currentUserId });
            let restante = montoAbono;
            let cuotasOrdenadas = [...cuotasDocs];
            cuotasOrdenadas.sort((a, b) => {
                const dateA = a.vencimiento?.toDate?.() || new Date(a.vencimiento);
                const dateB = b.vencimiento?.toDate?.() || new Date(b.vencimiento);
                return dateA - dateB;
            });
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
        showToast(`Abono por ${money(montoAbono)} aplicado correctamente.`);
    } catch (e) {
        if (e.message && e.message.includes("saldado")) showToast(e.message, 'warning');
        else { console.error("Fallo la transaccion:", e); showToast("Error al procesar el abono. Inténtelo de nuevo.", 'danger'); }
    }
});

// FILTRO CLIENTE ABONO change -> repuebla prestamos select
$id("filtroClienteAbono")?.addEventListener("change", (e)=>{
    populatePrestamosSelect(e.target.value);
});

// AL CAMBIAR SELECT DE ABONO: mostrar info de cuota y saldo
$id("abonoPrestamo")?.addEventListener("change", () => {
    const pid = $id("abonoPrestamo").value;
    const infoBox = $id("infoPrestamoAbono");
    if (!infoBox) return;
    if (!pid) { infoBox.style.display = "none"; return; }
    const p = prestamosByUser[pid];
    if (!p) { infoBox.innerHTML = "⚠️ Préstamo no encontrado."; infoBox.style.display = "block"; return; }
    const cuotas = cuotasByPrestamo[pid] || [];
    const totalCuotas = cuotas.length;
    const siguienteCuota = cuotas.filter(c => !c.pagada).sort((a,b)=> (a.numero||0)-(b.numero||0))[0];
    const valorCuota = siguienteCuota ? Number(siguienteCuota.monto) : 0;
    const nroCuota = siguienteCuota ? siguienteCuota.numero : totalCuotas;
    const total = cuotas.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
    const abonado = abonosByPrestamo[pid] || 0;
    const saldo = total - abonado;
    infoBox.innerHTML = `
        <b>Próxima cuota:</b> ${siguienteCuota ? `#${nroCuota} — ${money(valorCuota)}` : '✅ Todas pagadas'}<br>
        <b>Saldo pendiente:</b> ${money(saldo)}<br>
        <b>Total de cuotas:</b> ${totalCuotas}
    `;
    infoBox.style.display = "block";
});

// HISTORIAL (exportar y refrescar)
function exportarHistorialCSV() {
    showToast("Función de exportar ejecutada (revisa la consola).", 'info');
}
$id("btnExportarHistorial")?.addEventListener("click", exportarHistorialCSV);
$id("btnRefrescarHistorial")?.addEventListener("click", refreshHistorial);

function refreshHistorial(){
    const filterText = $id("historialFiltro")?.value?.trim().toLowerCase() || '';
    const tbody = $id("historialTable")?.querySelector("tbody");
    if(!tbody) return;
    tbody.innerHTML = "";
    for(const pid in prestamosByUser){
        const p = prestamosByUser[pid];
        const clientName = clientsById[p.clienteId]?.nombre || p.clienteId;
        if(filterText && !clientName.toLowerCase().includes(filterText) && !p.clienteId.toLowerCase().includes(filterText)) continue;
        const totalCuotasAdeudado = (cuotasByPrestamo[pid] || []).reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
        const totalAb = abonosByPrestamo[pid] || 0;
        const saldo = totalCuotasAdeudado - totalAb;
        const status = getPrestamoStatus(pid).status;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${pid}</td>
            <td>${clientName}</td>
            <td>${money(p.monto)}</td>
            <td>${Number(p.interes||0).toFixed(2)}</td>
            <td>${p.cuotas}</td>
            <td>${money(totalAb)}</td>
            <td class="${saldo > 0 ? 'text-danger' : 'text-success'}"><b>${money(saldo)}</b></td>
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
                    const c_id = cdata.id;
                    let estado;
                    if(cdata.pagada) estado = "Pagada";
                    else if(cdata.pagado_parcial && cdata.pagado_parcial > 0) estado = `Parcial (${money(cdata.pagado_parcial)})`;
                    else estado = "Pendiente";
                    const btnTxt = cdata.pagada ? 'Desmarcar' : 'Marcar pagada';
                    const btnCls = cdata.pagada ? 'btn-danger' : 'btn-success';
                    let vencimientoStr = "";
                    try { vencimientoStr = cdata.vencimiento?.toDate?.()?.toLocaleDateString() || new Date(cdata.vencimiento).toLocaleDateString(); } catch(e) { vencimientoStr = "N/A"; }
                    html += `<div class="d-flex justify-content-between align-items-center border p-2 mb-1">
                        <div>Cuota ${cdata.numero} — <strong>${money(cdata.monto)}</strong> (Venc.: ${vencimientoStr}) — <small class="text-primary">${estado}</small></div>
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
                        const updateData = { pagada: isMark, pagado_parcial: isMark ? 0 : (cuotasByPrestamo[pid].find(c => c.id === qid)?.pagado_parcial || 0) };
                        if (!isMark) delete updateData.pagado_parcial;
                        try { await updateDoc(cuotaRef, updateData); } catch(err) { console.error("Error al actualizar cuota:", err); showToast("No se pudo actualizar la cuota.", 'danger'); }
                    };
                });
            } else expRow.style.display = "none";
        };
    });
}

// DASHBOARD
let chartInstance, chartClientes;
function updateCuotaCounters(){
    const hoy = dayjs().startOf('day');
    let vencidas = 0, proximas = 0;
    for(const pid in prestamosByUser){
        const cuotas = cuotasByPrestamo[pid] || [];
        for(const c of cuotas){
            if(c.pagada) continue;
            const fechaV = dayjs(c.vencimiento?.toDate?.() || c.vencimiento).startOf('day');
            const diffDias = fechaV.diff(hoy,'day');
            if(diffDias < 0) vencidas++; else if(diffDias >=0 && diffDias <=7) proximas++;
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
    const totalAbonos = Object.values(abonosByPrestamo).reduce((a,b)=>a+b,0);
    $id("dashTotalPrestamos").textContent=money(prestamosActual);
    $id("dashTotalAbonos").textContent=money(totalAbonos);
    const trend = prestamosAnterior > 0 ? ((prestamosActual - prestamosAnterior) / prestamosAnterior) * 100 : (prestamosActual > 0 ? 100 : 0);
    $id("dashPrestamosTrend").textContent = `${trend >= 0 ? '🔼' : '🔽'} ${Math.abs(trend).toFixed(1)}% vs mes anterior`;
    $id("dashAbonosTrend").textContent="N/A (Total Histórico)";
    updateCuotaCounters();
    // Charts (if Chart.js loaded)
    const ctx=document.getElementById("dashChart")?.getContext("2d");
    if(ctx && typeof Chart !== 'undefined'){
        if(chartInstance) chartInstance.destroy();
        chartInstance=new Chart(ctx,{ type:'bar', data:{ labels:['Préstamos Act.','Préstamos Ant.'], datasets:[{label:'Préstamos',data:[prestamosActual,prestamosAnterior]}] }, options:{responsive:true,maintainAspectRatio:false} });
    }
    const montosPorCliente = {};
    for(const pid in prestamosByUser){ const p=prestamosByUser[pid]; montosPorCliente[p.clienteId]=(montosPorCliente[p.clienteId]||0)+Number(p.monto||0); }
    const totalPrestamosClientes = Object.values(montosPorCliente).reduce((a,b)=>a+b,0);
    const nombresClientes = [], valoresPrestamos = [];
    for(const [cid,monto] of Object.entries(montosPorCliente)){
        if(monto>0){
            const nombre = clientsById[cid]?.nombre || cid;
            const porcentaje = ((monto/totalPrestamosClientes)*100).toFixed(1);
            nombresClientes.push(`${nombre} – ${money(monto)} (${porcentaje}%)`);
            valoresPrestamos.push(monto);
        }
    }
    const ctxClientes=document.getElementById("dashChartClientes")?.getContext("2d");
    if(ctxClientes && typeof Chart !== 'undefined'){
        if(chartClientes) chartClientes.destroy();
        chartClientes=new Chart(ctxClientes,{ type:'doughnut', data:{ labels:nombresClientes, datasets:[{label:'Monto total de préstamos', data:valoresPrestamos}] }, options:{responsive:true,plugins:{legend:{position:'right'}}} });
    }
}

document.querySelector('button[data-bs-target="#tab-dashboard"]')?.addEventListener('shown.bs.tab', () => { refreshDashboard(); });

// ÚLTIMOS ABONOS - RENDER
function renderUltimosAbonos() {
    const ul = $id("abonosList");
    if (!ul) return;
    ul.innerHTML = "";
    if (abonosList.length === 0) {
        ul.innerHTML = `<li class="list-group-item text-center text-muted">No hay abonos registrados.</li>`;
        return;
    }
    for (const abono of abonosList.slice(0, 10)) {
        const p = prestamosByUser[abono.prestamoId];
        const cliente = p ? (clientsById[p.clienteId]?.nombre || "Cliente desconocido") : "Sin préstamo";
        const fecha = abono.fecha?.toDate?.() || new Date(abono.fecha);
        const cuotas = (cuotasByPrestamo[abono.prestamoId] || []).slice().sort((a,b)=> (a.numero||0)-(b.numero||0));
        const totalCuotas = cuotas.length;
        const siguiente = cuotas.find(c => !c.pagada);
        const nroCuota = siguiente ? (siguiente.numero) : (totalCuotas || 0);
        const total = cuotas.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
        const abonado = abonosByPrestamo[abono.prestamoId] || 0;
        const saldo = total - abonado;
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.style.cursor = "pointer";
        li.dataset.pid = abono.prestamoId;
        li.dataset.abonoid = abono.id;
        li.innerHTML = `
            <div>
                💰 <strong>${money(abono.monto)}</strong> — ${cliente}<br>
                <small class="text-muted">${fecha.toLocaleString()} | Próx. cuota: ${nroCuota} de ${totalCuotas} | Saldo restante: ${money(saldo)}</small>
            </div>
            <span class="badge bg-success">OK</span>
        `;
        ul.appendChild(li);
    }
}

// Document-level click handler for abonos -> muestra modal detalle
document.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-abonoid]');
    if (!li) return;
    const abonoId = li.dataset.abonoid;
    const prestamoId = li.dataset.pid;
    handleAbonoClick(abonoId, prestamoId);
});

function handleAbonoClick(abonoId, prestamoId){
    const abono = abonosList.find(a=>a.id === abonoId) || {};
    const prestamo = prestamosByUser[prestamoId] || {};
    const cliente = prestamo ? clientsById[prestamo.clienteId] : null;
    const cuotas = (cuotasByPrestamo[prestamoId] || []).slice().sort((a,b)=> (a.numero||0)-(b.numero||0));
    let cuotaAfectada = cuotas.find(c => Number(c.pagado_parcial) > 0 && !c.pagada)
        || cuotas.find(c => c.pagada && (c.numero === Math.max(...cuotas.filter(x=>x.pagada).map(x=>x.numero), 0)))
        || cuotas.find(c => !c.pagada);
    const total = cuotas.reduce((s,c)=>s + (Number(c.monto)||0), 0);
    const abonadoTotal = abonosByPrestamo[prestamoId] || 0;
    const saldo = total - abonadoTotal;
    showAbonoDetailModal({ abono, prestamo, cliente, cuotaAfectada, cuotas, saldo });
}

// Modal dinámico (Bootstrap) con botones Ver Cliente / Ver Préstamo / Cerrar
// function showAbonoDetailModal(data){
//     const { abono = {}, prestamo = {}, cliente = {}, cuotaAfectada, cuotas = [], saldo } = data;
//     let modalEl = document.getElementById('abonoDetailModal');
//     if (!modalEl) {
//         modalEl = document.createElement('div');
//         modalEl.id = 'abonoDetailModal';
//         modalEl.className = 'modal fade';
//         modalEl.tabIndex = -1;
//         modalEl.innerHTML = `
//         <div class="modal-dialog modal-lg">
//           <div class="modal-content">
//             <div class="modal-header bg-light">
//               <h5 class="modal-title">Detalle del Abono</h5>
//               <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
//             </div>
//             <div class="modal-body" id="abonoDetailBody">Cargando...</div>
//             <div class="modal-footer">
//               <button id="btnVerClienteDesdeAbono" type="button" class="btn btn-outline-primary">👤 Ver Cliente</button>
//               <button id="btnVerPrestamoDesdeAbono" type="button" class="btn btn-outline-secondary">🧾 Ver Préstamo</button>
//               <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
//             </div>
//           </div>
//         </div>`;
//         document.body.appendChild(modalEl);
//     }

//     const body = modalEl.querySelector('#abonoDetailBody');
//     const fecha = abono.fecha?.toDate?.() || new Date(abono.fecha || Date.now());
//     const abonoMonto = money(abono.monto || 0);

//     let cuotasHtml = '';
//     if (cuotas.length === 0) {
//         cuotasHtml = '<p class="text-muted">No hay cuotas registradas para este préstamo.</p>';
//     } else {
//         cuotasHtml = '<div class="list-group mb-2">';
//         for (const c of cuotas) {
//             const venc = c.vencimiento?.toDate?.() || (c.vencimiento ? new Date(c.vencimiento) : null);
//             const vencStr = venc ? venc.toLocaleDateString() : 'N/A';
//             const estado = c.pagada ? 'Pagada' : (Number(c.pagado_parcial) > 0 ? `Parcial (${money(c.pagado_parcial)})` : 'Pendiente');
//             const highlight = (cuotaAfectada && cuotaAfectada.id === c.id) ? 'border-primary' : '';
//             cuotasHtml += `<div class="list-group-item d-flex justify-content-between align-items-center ${highlight}">
//                 <div>Cuota ${c.numero} — <strong>${money(c.monto)}</strong><br><small>Venc.: ${vencStr}</small></div>
//                 <div><small class="text-muted">${estado}</small></div>
//             </div>`;
//         }
//         cuotasHtml += '</div>';
//     }

//     const banco = prestamo?.banco || 'N/A';
//     const observacion = prestamo?.observacion || '';

//     body.innerHTML = `
//         <div>
//             <p><strong>Monto abonado:</strong> ${abonoMonto}</p>
//             <p><strong>Fecha:</strong> ${fecha.toLocaleString()}</p>
//             <p><strong>Préstamo ID:</strong> ${prestamo?.id || abono.prestamoId || 'N/A'}</p>
//             <p><strong>Cliente:</strong> ${cliente?.nombre || 'N/A'}</p>
//             <p><strong>Banco:</strong> ${banco}</p>
//             <p><strong>Observación:</strong> ${observacion}</p>
//             <p><strong>Cuota probable afectada:</strong> ${cuotaAfectada ? cuotaAfectada.numero : 'N/A'}</p>
//             <p><strong>Saldo restante:</strong> ${money(saldo)}</p>
//             <hr>
//             <h6>Detalle de cuotas</h6>
//             ${cuotasHtml}
//         </div>
//     `;

//     const bsModal = new bootstrap.Modal(modalEl);
//     bsModal.show();

//     // Botones funcionales
//     modalEl.querySelector('#btnVerClienteDesdeAbono').onclick = () => {
//         if (cliente && cliente.id) {
//             bsModal.hide();
//             showClientProfileModal(cliente.id);
//         } else if (prestamo && prestamo.clienteId) {
//             bsModal.hide();
//             showClientProfileModal(prestamo.clienteId);
//         } else showToast("No se encontró cliente.", "warning");
//     };

//     modalEl.querySelector('#btnVerPrestamoDesdeAbono').onclick = () => {
//         if (prestamo && prestamo.id) {
//             bsModal.hide();
//             // Cambiar a tab de préstamos y seleccionar (resaltar) el préstamo
//             const bsTab = new bootstrap.Tab($id('tabs').querySelector(`[data-bs-target="#tab-prestamos"]`));
//             bsTab.show();
//             // Opcional: resaltar el préstamo en la lista (temporal)
//             setTimeout(()=>{
//                 const selector = `li.list-group-item:contains("${prestamo.id}")`;
//                 // fallback: scroll into view searching by text
//                 const items = Array.from($id('prestamosList').children || []);
//                 const item = items.find(it => it.textContent.includes(prestamo.id));
//                 if (item) { item.classList.add('bg-warning'); setTimeout(()=>item.classList.remove('bg-warning'), 2500); item.scrollIntoView({behavior:'smooth', block:'center'}); }
//             }, 200);
//         } else showToast("No se encontró préstamo.", "warning");
//     };
// }

// ... (código anterior)

// Modal dinámico (Bootstrap) con botones Ver Cliente / Ver Préstamo / Cerrar
// Modal dinámico (Bootstrap) con botones Ver Cliente / Ver Préstamo / Cerrar
function showAbonoDetailModal(data){
    const { abono = {}, prestamo = {}, cliente = {}, cuotaAfectada, cuotas = [], saldo } = data;
    let modalEl = document.getElementById('abonoDetailModal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'abonoDetailModal';
        modalEl.className = 'modal fade';
        modalEl.tabIndex = -1;
        // **ACTUALIZADO: Encabezado con bg-primary y botones con btn-close-white para coincidir con el modal de cliente**
        modalEl.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">Detalle del Abono</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="abonoDetailBody">Cargando...</div>
            <div class="modal-footer">
              <button id="btnVerClienteDesdeAbono" type="button" class="btn btn-outline-primary">👤 Ver Cliente</button>
              <button id="btnVerPrestamoDesdeAbono" type="button" class="btn btn-outline-secondary">🧾 Ver Préstamo</button>
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>`;
        document.body.appendChild(modalEl);
    }
    // NOTA: Si el modal ya existe, nos aseguramos de que el header tenga la clase correcta
    const modalHeader = modalEl.querySelector('.modal-header');
    if (!modalHeader.classList.contains('bg-primary')) {
        modalHeader.className = 'modal-header bg-primary text-white';
        modalEl.querySelector('.btn-close').classList.add('btn-close-white');
    }

    const body = modalEl.querySelector('#abonoDetailBody');
    const fecha = abono.fecha?.toDate?.() || new Date(abono.fecha || Date.now());
    const abonoMonto = money(abono.monto || 0);

    // Renderizado de cuotas (usando list-group-flush para un mejor look)
    let cuotasHtml = '';
    if (cuotas.length === 0) {
        cuotasHtml = '<p class="text-muted text-center">No hay cuotas registradas para este préstamo.</p>';
    } else {
        cuotasHtml = '<div class="list-group list-group-flush">';
        for (const c of cuotas) {
            const venc = c.vencimiento?.toDate?.() || (c.vencimiento ? new Date(c.vencimiento) : null);
            const vencStr = venc ? venc.toLocaleDateString() : 'N/A';
            const estado = c.pagada ? 'Pagada' : (Number(c.pagado_parcial) > 0 ? `Parcial (${money(c.pagado_parcial)})` : 'Pendiente');
            // Resaltamos la cuota que fue impactada por este abono
            const highlight = (cuotaAfectada && cuotaAfectada.id === c.id) ? 'border-start border-3 border-danger' : ''; 
            cuotasHtml += `<div class="list-group-item d-flex justify-content-between align-items-center ${highlight}">
                <div>
                    <strong>Cuota ${c.numero}</strong> — ${money(c.monto)}<br>
                    <small>Venc.: ${vencStr}</small>
                </div>
                <div class="text-end">
                    <small class="${c.pagada ? 'text-success' : 'text-danger'}">${estado}</small>
                </div>
            </div>`;
        }
        cuotasHtml += '</div>';
    }

    const banco = prestamo?.banco || 'N/A';
    const observacion = prestamo?.observacion || 'Sin observación';
    const clienteNombre = cliente?.nombre || 'N/A';
    const prestamoId = prestamo?.id || abono.prestamoId || 'N/A';

    // **ACTUALIZADO: Cuerpo del modal con estructura de cliente (Resumen + Secciones)**
    body.innerHTML = `
        <div class="row mb-4">
            <div class="col-md-6">
                <h6>Datos del Abono</h6>
                <p class="mb-1"><strong>Monto abonado:</strong> <span class="fs-5 text-success">${abonoMonto}</span></p>
                <p class="mb-1"><strong>Fecha:</strong> ${fecha.toLocaleString()}</p>
                <p class="mb-1"><strong>Cliente:</strong> ${clienteNombre}</p>
            </div>
            <div class="col-md-6 text-end">
                <h6>Resumen Préstamo</h6>
                <p class="mb-1"><strong>Préstamo ID:</strong> ${prestamoId}</p>
                <p class="mb-1"><strong>Saldo Pendiente:</strong> <span class="fs-4 text-danger">${money(saldo)}</span></p>
                <p class="mb-1"><strong>Cuota Impactada:</strong> ${cuotaAfectada ? cuotaAfectada.numero : 'N/A'}</p>
            </div>
        </div>
        
        <h6 class="border-bottom pb-2">Información Adicional del Préstamo</h6>
        <div class="row mb-3">
            <div class="col-md-6">
                <p class="mb-1"><strong>Banco:</strong> ${banco}</p>
            </div>
            <div class="col-md-6">
                <p class="mb-1"><strong>Observación:</strong> ${observacion}</p>
            </div>
        </div>

        <h6 class="border-bottom pb-2">Detalle de Cuotas del Préstamo (La marcada en rojo fue la impactada)</h6>
        <div style="max-height: 300px; overflow-y: auto;">
            ${cuotasHtml}
        </div>
    `;

    // Lógica para mostrar el modal (Esto es crítico)
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    // Botones funcionales
    modalEl.querySelector('#btnVerClienteDesdeAbono').onclick = () => {
        if (cliente && cliente.id) {
            bsModal.hide();
            showClientProfileModal(cliente.id);
        } else if (prestamo && prestamo.clienteId) {
            bsModal.hide();
            showClientProfileModal(prestamo.clienteId);
        } else showToast("No se encontró cliente.", "warning");
    };

    modalEl.querySelector('#btnVerPrestamoDesdeAbono').onclick = () => {
        if (prestamo && prestamo.id) {
            bsModal.hide();
            // Cambiar a tab de préstamos y seleccionar (resaltar) el préstamo
            const bsTab = new bootstrap.Tab($id('tabs').querySelector(`[data-bs-target="#tab-prestamos"]`));
            bsTab.show();
            // Opcional: resaltar el préstamo en la lista (temporal)
            setTimeout(()=>{
                const items = Array.from($id('prestamosList').children || []);
                const item = items.find(it => it.textContent.includes(prestamo.id));
                if (item) { item.classList.add('bg-warning'); setTimeout(()=>item.classList.remove('bg-warning'), 2500); item.scrollIntoView({behavior:'smooth', block:'center'}); }
            }, 200);
        } else showToast("No se encontró préstamo.", "warning");
    };
}

// Utility: polyfill contains selector (used above) — but we used fallback, so not necessary

// Final export
window.loadPrestamosList = loadPrestamosList;

console.log("main.js completo cargado. Sistema listo.");