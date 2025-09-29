import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
// NUEVAS IMPORTACIONES: Solo necesitamos verificar sesión y cerrar sesión
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

let clientsById = {};

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
  // Redirigir al usuario a la página de login
  window.location.href = "login.html"; 
});


// Manejador del estado de la autenticación
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Usuario logeado: Iniciar la aplicación
    $id('userEmailDisplay').textContent = user.email;

    // Ejecutar la carga inicial de datos solo si no se ha hecho
    // Esto evita que el código se ejecute múltiples veces si se reactiva la pestaña
    if ($id("clientesList").innerHTML === "") { 
        initialLoad(); 
    }

  } else {
    // Usuario NO logeado: Redirigir a login.html
    window.location.href = "login.html";
  }
});

// ######################################################
// ################# FIN AUTENTICACIÓN ##################
// ######################################################


// ---------- CARGAS BÁSICAS ----------

async function loadClients(){
  const snap = await getDocs(collection(db,"clientes"));
  $id("clientesList").innerHTML = "";
  $id("prestamoCliente").innerHTML = "<option value=''>Seleccione cliente</option>";
  $id("filtroClienteAbono").innerHTML = "<option value=''>Filtrar por cliente (opcional)</option>";
  
  clientsById = {}; 

  for(const docu of snap.docs){
    const d = docu.data();
    clientsById[docu.id] = d; 
    
    $id("clientesList").innerHTML += `<li class="list-group-item"><strong>${d.nombre}</strong> — ${d.telefono||''} <small class="text-muted">(id: ${docu.id})</small></li>`;
    $id("prestamoCliente").innerHTML += `<option value="${docu.id}">${d.nombre}</option>`;
    $id("filtroClienteAbono").innerHTML += `<option value="${docu.id}">${d.nombre}</option>`;
  }
}

async function loadPrestamosList(){
  const snap = await getDocs(collection(db,"prestamos"));
  $id("prestamosList").innerHTML = "";

  const cuotasSnap = await getDocs(collection(db,"cuotas"));
  const cuotasByPrestamo = {};
  for(const c of cuotasSnap.docs){
    const d = c.data();
    (cuotasByPrestamo[d.prestamoId] ||= []).push(d);
  }

  for(const pdoc of snap.docs){
    const p = pdoc.data();
    const cuotas = cuotasByPrestamo[pdoc.id] || [];
    
    let vencidas = 0, proximas = 0;
    const hoy = new Date();
    for(const c of cuotas){
      const fechaCuota = c.vencimiento?.toDate?.() || new Date(c.vencimiento || hoy);
      
      const diffDias = (fechaCuota.getTime() - hoy.getTime())/(1000*60*60*24);

      if(!c.pagada && fechaCuota < hoy){ 
        vencidas++; 
      } else if(!c.pagada && diffDias <= 7 && diffDias >= 0){ 
        proximas++; 
      }
    }

    let borderClass = '';
    if(vencidas>0) borderClass='border-start border-4 border-danger';
    else if(proximas>0) borderClass='border-start border-4 border-warning';
    
    const clientName = clientsById[p.clienteId]?.nombre || p.clienteId; 

    let estadoText='';
    if(vencidas>0) estadoText=`<small class="text-danger">${vencidas} cuota(s) vencida(s)</small>`;
    else if(proximas>0) estadoText=`<small class="text-warning">${proximas} próxima(s) a vencer</small>`;

    const fechaCreacion = p.fecha?.toDate ? p.fecha.toDate() : new Date(p.fecha);
    const fechaStr = fechaCreacion.toLocaleDateString();
    
    $id("prestamosList").innerHTML += `
      <li class="list-group-item ${borderClass}">
        <strong>Cliente:</strong> ${clientName} — Monto ${money(p.monto)} — Cuotas: ${p.cuotas}
        <br><small>Banco: ${p.banco||'-'} | Obs: ${p.observacion||'-'} | <b>Fecha:</b> ${fechaStr}</small>
        <br>${estadoText}
      </li>
    `;
  }
}

async function populatePrestamosSelect(clienteFiltro=''){
  let q = collection(db,"prestamos");
  if(clienteFiltro) q = query(q, where("clienteId","==", clienteFiltro));
  const snap = await getDocs(q);
  
  $id("abonoPrestamo").innerHTML = "<option value=''>Seleccione préstamo</option>";
  
  for(const docu of snap.docs){
    const d = docu.data();
    const clientName = clientsById[d.clienteId]?.nombre || d.clienteId; 
    const observacion = d.observacion ? ` | Obs: ${d.observacion}` : '';
    
    $id("abonoPrestamo").innerHTML += `<option value="${docu.id}">${clientName} — $${money(d.monto)}${observacion}</option>`;
  }
}

async function loadAbonos(){
  const snap = await getDocs(collection(db,"abonos"));
  $id("abonosList").innerHTML = "";
  for(const docu of snap.docs){
    const a = docu.data();
    let dateStr = "";
    try{ dateStr = a.fecha && a.fecha.toDate ? a.fecha.toDate().toLocaleString() : new Date(a.fecha).toLocaleString(); }catch(e){ dateStr = ""; }
    $id("abonosList").innerHTML += `<li class="list-group-item">Préstamo: ${a.prestamoId} — Monto: ${money(a.monto)} — ${dateStr}</li>`;
  }
}

// ---------- FORMULARIOS ----------
$id("clienteForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const nombre = $id("clienteNombre").value.trim();
  const telefono = $id("clienteTelefono").value.trim();
  if(!nombre) return showToast("Nombre requerido", 'danger');
  await addDoc(collection(db,"clientes"), { nombre, telefono });
  $id("clienteForm").reset();
  showToast(`Cliente ${nombre} registrado con éxito.`);
  await loadClients();
  await refreshDashboard();
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

  const montoConInteres = monto * (1 + (interes / 100));
  const montoCuota = Number((montoConInteres / cuotas).toFixed(2));
  const fechaBase = new Date();

  const prestRef = await addDoc(collection(db,"prestamos"), { 
    clienteId, 
    monto, 
    interes, 
    cuotas, 
    montoTotalCuotas: montoConInteres, 
    banco, 
    observacion, 
    fecha:new Date() 
  });

  for(let i=1;i<=cuotas;i++){
    const fechaV = new Date(fechaBase);
    const targetMonth = fechaBase.getMonth() + i;
    fechaV.setMonth(targetMonth);
    
    if (fechaV.getMonth() !== targetMonth % 12) {
        fechaV.setDate(0); 
    }

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
  await loadPrestamosList();
  await refreshDashboard();
});

$id("abonoForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const prestamoId = $id("abonoPrestamo").value;
  let montoAbono = parseFloat($id("abonoMonto").value);
  
  if(!prestamoId || !montoAbono) return showToast("Seleccione préstamo e ingrese monto", 'danger');
  
  const cuotasSnap = await getDocs(query(collection(db,"cuotas"), where("prestamoId","==", prestamoId)));
  const abonosSnap = await getDocs(query(collection(db,"abonos"), where("prestamoId","==", prestamoId)));
  
  const totalCuotas = cuotasSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().monto) || 0), 0);
  const totalAbonadoPrevio = abonosSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().monto) || 0), 0);
  
  const saldoPendiente = totalCuotas - totalAbonadoPrevio;
  
  if(saldoPendiente <= 0) return showToast("¡Este préstamo ya está saldado!", 'warning');
  
  if(montoAbono > saldoPendiente){
      showToast(`El abono ($${money(montoAbono)}) excede el saldo pendiente ($${money(saldoPendiente)}). Solo se aplicarán $${money(saldoPendiente)}.`, 'warning');
      montoAbono = saldoPendiente;
  }
  
  if(montoAbono <= 0) return;
  
  await addDoc(collection(db,"abonos"), { prestamoId, monto: montoAbono, fecha: new Date() }); 
  
  let restante = montoAbono; 
  
  let cuotasOrdenadas = cuotasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  cuotasOrdenadas.sort((a, b) => (a.numero || 0) - (b.numero || 0));
  
  for(const cdata of cuotasOrdenadas){
      if(restante <= 0) break;
      const cuotaRef = doc(db,"cuotas", cdata.id);
      
      const montoCuota = Number(cdata.monto) || 0;
      const pagadoParcial = Number(cdata.pagado_parcial) || 0;
      
      const montoFaltante = montoCuota - pagadoParcial; 
      
      if(cdata.pagada || montoFaltante <= 0) continue;
      
      if(restante >= montoFaltante){
          await updateDoc(cuotaRef, { pagada: true, pagado_parcial: 0 }); 
          restante -= montoFaltante;
      } else {
          await updateDoc(cuotaRef, { pagado_parcial: pagadoParcial + restante });
          restante = 0;
      }
  }

  $id("abonoForm").reset();
  showToast(`Abono por $${money(montoAbono)} aplicado correctamente.`);
  await loadAbonos();
  await refreshHistorial();
  await refreshDashboard();
});


$id("filtroClienteAbono").addEventListener("change", async (e)=>{
  await populatePrestamosSelect(e.target.value);
});

// ---------- HISTORIAL ----------
async function refreshHistorial(){
  const filterText = $id("historialFiltro").value.trim().toLowerCase();
  const prestamosSnap = await getDocs(collection(db,"prestamos"));
  const tbody = $id("historialTable").querySelector("tbody");
  tbody.innerHTML = "";
  
  const abonosSnap = await getDocs(collection(db,"abonos"));
  const abonosByPrest = {};
  for(const a of abonosSnap.docs){ 
    const d = a.data(); 
    abonosByPrest[d.prestamoId] = (abonosByPrest[d.prestamoId]||0) + (Number(d.monto)||0); 
  }
  
  const cuotasSnapTotal = await getDocs(collection(db,"cuotas"));
  const totalCuotasByPrest = {};
  for(const c of cuotasSnapTotal.docs){ 
    const d = c.data(); 
    totalCuotasByPrest[d.prestamoId] = (totalCuotasByPrest[d.prestamoId] || 0) + (Number(d.monto) || 0);
  }
  
  for(const p of prestamosSnap.docs){
    const d = p.data();
    const clientName = clientsById[d.clienteId]?.nombre || d.clienteId; 
    
    if(filterText && !clientName.toLowerCase().includes(filterText) && !d.clienteId.toLowerCase().includes(filterText)) continue;
    
    const totalCuotasAdeudado = totalCuotasByPrest[p.id] || Number(d.monto||0); 
    const totalAb = abonosByPrest[p.id] || 0;
    const saldo = Number(totalCuotasAdeudado - totalAb).toFixed(2); 
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${clientName}</td>
      <td>${money(d.monto)}</td>
      <td>${Number(d.interes||0).toFixed(2)}</td>
      <td>${d.cuotas}</td>
      <td>${money(totalAb)}</td>
      <td class="${saldo > 0 ? 'text-danger' : 'text-success'}"><b>${saldo}</b></td>
      <td>${d.banco||''}</td>
      <td>${d.observacion||''}</td>
      <td><button class="btn btn-sm btn-outline-info btn-view" data-id="${p.id}">Ver cuotas</button></td>
    `;
    tbody.appendChild(tr);
    const exp = document.createElement("tr");
    exp.style.display = "none";
    exp.id = "exp_"+p.id;
    exp.innerHTML = `<td colspan="10"><div id="expbody_${p.id}">—</div></td>`; 
    tbody.appendChild(exp);
  }
  
  document.querySelectorAll(".btn-view").forEach(btn => {
    btn.onclick = async (ev) => {
      const pid = ev.target.dataset.id;
      const expRow = document.getElementById("exp_"+pid);
      const body = document.getElementById("expbody_"+pid);
      if(expRow.style.display === "none"){
        const cuotasSnap = await getDocs(query(collection(db,"cuotas"), where("prestamoId","==", pid)));
        
        let cuotasOrdenadas = cuotasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cuotasOrdenadas.sort((a, b) => (a.numero || 0) - (b.numero || 0));
        
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

            await refreshHistorial();
            await loadPrestamosList(); 
            await refreshDashboard();
          };
        });
      } else {
        expRow.style.display = "none";
      }
    };
  });
}
$id("btnRefrescarHistorial").addEventListener("click", refreshHistorial);

// ---------- DASHBOARD ----------
let chartInstance;
let chartClientes;

async function updateCuotaCounters(){
  const hoy = new Date();
  const tresDias = new Date();
  tresDias.setDate(hoy.getDate()+3); 

  let vencidas = 0;
  let proximas = 0;

  const cuotasSnap = await getDocs(collection(db,"cuotas"));
  cuotasSnap.forEach(c=>{
    const d=c.data();
    if(d.pagada) return;
    const fechaV = d.vencimiento?.toDate?.() || new Date(d.vencimiento || hoy);
    if(fechaV < hoy) vencidas++;
    else if(fechaV >= hoy && fechaV <= tresDias) proximas++;
  });

  $id("dashCuotasVencidas").textContent = vencidas;
  $id("dashCuotasPorVencer").textContent = proximas;
}


async function refreshDashboard(){
  const now=new Date();
  const currentMonth=now.getMonth();
  const lastMonth=(currentMonth+11)%12;

  let prestamosActual=0,prestamosAnterior=0;
  let abonosActual=0,abonosAnterior=0;

  const presSnap = await getDocs(collection(db,"prestamos"));
  presSnap.forEach(p=>{
    const d=p.data();
    const fecha=d.fecha?.toDate?.()||new Date(d.fecha||now);
    if(fecha.getMonth()===currentMonth) prestamosActual+=Number(d.monto||0);
    else if(fecha.getMonth()===lastMonth) prestamosAnterior+=Number(d.monto||0);
  });

  const abSnap = await getDocs(collection(db,"abonos"));
  abSnap.forEach(a=>{
    const d=a.data();
    const fecha=d.fecha?.toDate?.()||new Date(d.fecha||now);
    if(fecha.getMonth()===currentMonth) abonosActual+=Number(d.monto||0);
    else if(fecha.getMonth()===lastMonth) abonosAnterior+=Number(d.monto||0);
  });

  $id("dashTotalPrestamos").textContent=money(prestamosActual);
  $id("dashTotalAbonos").textContent=money(abonosActual);
  $id("dashPrestamosTrend").textContent=prestamosActual>=prestamosAnterior?"🔼 vs mes anterior":"🔽 vs mes anterior";
  $id("dashAbonosTrend").textContent=abonosActual>=abonosAnterior?"🔼 vs mes anterior":"🔽 vs mes anterior";

  await updateCuotaCounters(); 

  const ctx=document.getElementById("dashChart").getContext("2d");
  if(chartInstance){chartInstance.destroy();}
  chartInstance=new Chart(ctx,{
    type:'bar',
    data:{
      labels:['Mes actual','Mes anterior'],
      datasets:[
        {label:'Préstamos',data:[prestamosActual,prestamosAnterior],backgroundColor:'#e84118'},
        {label:'Abonos',data:[abonosActual,abonosAnterior],backgroundColor:'#44bd32'}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false}
  });

if(chartClientes){ chartClientes.destroy(); }

const presSnap2 = await getDocs(collection(db,"prestamos"));

const montosPorCliente = {};
for(const cid in clientsById) montosPorCliente[cid] = 0; 

presSnap2.forEach(p=>{
  const d=p.data();
  montosPorCliente[d.clienteId]=(montosPorCliente[d.clienteId]||0)+Number(d.monto||0);
});

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

const ctxClientes=document.getElementById("dashChartClientes").getContext("2d");
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

document.querySelector('button[data-bs-target="#tab-dashboard"]').addEventListener('shown.bs.tab', () => {
  refreshDashboard();
});

// Función de carga inicial para ser llamada SOLO después del login
async function initialLoad(){
    await loadClients();
    await loadPrestamosList();
    await populatePrestamosSelect();
    await loadAbonos();
    await refreshHistorial();
    await refreshDashboard();
}