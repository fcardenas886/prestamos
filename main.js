import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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

function $id(id){ return document.getElementById(id); }
function money(n){ return Number(n||0).toFixed(2); }

// ---------- CARGAS BÁSICAS ----------
async function loadClients(){
  const snap = await getDocs(collection(db,"clientes"));
  $id("clientesList").innerHTML = "";
  $id("prestamoCliente").innerHTML = "<option value=''>Seleccione cliente</option>";
  $id("filtroClienteAbono").innerHTML = "<option value=''>Filtrar por cliente (opcional)</option>";
  for(const docu of snap.docs){
    const d = docu.data();
    $id("clientesList").innerHTML += `<li class="list-group-item"><strong>${d.nombre}</strong> — ${d.telefono||''} <small class="text-muted">(id: ${docu.id})</small></li>`;
    $id("prestamoCliente").innerHTML += `<option value="${docu.id}">${d.nombre}</option>`;
    $id("filtroClienteAbono").innerHTML += `<option value="${docu.id}">${d.nombre}</option>`;
  }
}

async function loadPrestamosList(){
  const snap = await getDocs(collection(db,"prestamos"));
  $id("prestamosList").innerHTML = "";

  // Traemos las cuotas para saber vencidas/próximas
  const cuotasSnap = await getDocs(collection(db,"cuotas"));
  const cuotasByPrestamo = {};
  for(const c of cuotasSnap.docs){
    const d = c.data();
    (cuotasByPrestamo[d.prestamoId] ||= []).push(d);
  }

  for(const pdoc of snap.docs){
    const p = pdoc.data();
    const cuotas = cuotasByPrestamo[pdoc.id] || [];
    
    // calcular vencidas y próximas (ejemplo: vencidas = pagada==false y fecha<ahora)
    let vencidas = 0, proximas = 0;
    const hoy = new Date();
    for(const c of cuotas){
      const fechaCuota = c.vencimiento?.toDate?.() || new Date(c.vencimiento || hoy); // Usar vencimiento
      
      const diffDias = (fechaCuota.getTime() - hoy.getTime())/(1000*60*60*24);

      if(!c.pagada && fechaCuota < hoy){ 
        vencidas++; 
      } else if(!c.pagada && diffDias <= 7){ // próximas en 7 días
        proximas++; 
      }
    }

    // estilo según estado
    let borderClass = '';
    if(vencidas>0) borderClass='border-start border-4 border-danger';
    else if(proximas>0) borderClass='border-start border-4 border-warning';

    let estadoText='';
    if(vencidas>0) estadoText=`<small class="text-danger">${vencidas} cuota(s) vencida(s)</small>`;
    else if(proximas>0) estadoText=`<small class="text-warning">${proximas} próxima(s) a vencer</small>`;

    const fechaCreacion = p.fecha?.toDate ? p.fecha.toDate() : new Date(p.fecha);
    const fechaStr = fechaCreacion.toLocaleDateString();
    $id("prestamosList").innerHTML += `
      <li class="list-group-item ${borderClass}">
        <strong>Cliente ID:</strong> ${p.clienteId} — Monto ${money(p.monto)} — Cuotas: ${p.cuotas}
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
  
  const clientsSnap = await getDocs(collection(db,"clientes"));
  const clientsById = {};
  for(const c of clientsSnap.docs) clientsById[c.id] = c.data().nombre;

  $id("abonoPrestamo").innerHTML = "<option value=''>Seleccione préstamo</option>";
  
  for(const docu of snap.docs){
    const d = docu.data();
    const clientName = clientsById[d.clienteId] || d.clienteId; 
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
  if(!nombre) return alert("Nombre requerido");
  await addDoc(collection(db,"clientes"), { nombre, telefono });
  $id("clienteForm").reset();
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
  if(!clienteId) return alert("Seleccione cliente");
  if(!monto || !cuotas) return alert("Monto y cuotas requeridos");

  // Guardar préstamo con fecha actual
  const prestRef = await addDoc(collection(db,"prestamos"), { 
    clienteId, 
    monto, 
    interes, 
    cuotas, 
    banco, 
    observacion, 
    fecha:new Date() 
  });

  // Crear cuotas con fecha de vencimiento
  for(let i=1;i<=cuotas;i++){
    const fechaV = new Date();
    fechaV.setMonth(fechaV.getMonth() + i - 1); 

    await addDoc(collection(db,"cuotas"), { 
      prestamoId: prestRef.id, 
      numero:i, 
      monto: Number((monto/cuotas).toFixed(2)), 
      pagada:false,
      vencimiento: fechaV 
    });
  }

  $id("prestamoForm").reset();
  await loadPrestamosList();
  await refreshDashboard();
});

$id("abonoForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const prestamoId = $id("abonoPrestamo").value;
  const monto = parseFloat($id("abonoMonto").value);
  if(!prestamoId || !monto) return alert("Seleccione préstamo e ingrese monto");
  await addDoc(collection(db,"abonos"), { prestamoId, monto, fecha: new Date() });
  // apply to cuotas in order
  const cuotasSnap = await getDocs(query(collection(db,"cuotas"), where("prestamoId","==", prestamoId)));
  let restante = monto;
  for(const cdoc of cuotasSnap.docs){
    if(restante<=0) break;
    const cuota = cdoc.data();
    if(cuota.pagada) continue;
    const montoCuota = Number(cuota.monto) || 0;
    if(restante >= montoCuota){
      await updateDoc(doc(db,"cuotas", cdoc.id), { pagada:true });
      restante -= montoCuota;
    } else {
      await updateDoc(doc(db,"cuotas", cdoc.id), { pagado_parcial: (cuota.pagado_parcial || 0) + restante });
      restante = 0;
    }
  }
  $id("abonoForm").reset();
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
  for(const a of abonosSnap.docs){ const d = a.data(); abonosByPrest[d.prestamoId] = (abonosByPrest[d.prestamoId]||0) + (Number(d.monto)||0); }
  const clientsSnap = await getDocs(collection(db,"clientes"));
  const clientsById = {};
  for(const c of clientsSnap.docs) clientsById[c.id] = c.data().nombre;
  
  for(const p of prestamosSnap.docs){
    const d = p.data();
    const clientName = clientsById[d.clienteId] || d.clienteId;
    if(filterText && !clientName.toLowerCase().includes(filterText) && !d.clienteId.toLowerCase().includes(filterText)) continue;
    const totalAb = abonosByPrest[p.id] || 0;
    const saldo = Number((d.monto||0) - totalAb).toFixed(2);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${clientName}</td>
      <td>${money(d.monto)}</td>
      <td>${Number(d.interes||0).toFixed(2)}</td>
      <td>${d.cuotas}</td>
      <td>${money(totalAb)}</td>
      <td>${saldo}</td>
      <td>${d.banco||''}</td>
      <td>${d.observacion||''}</td>
      <td><button class="btn btn-sm btn-outline-info btn-view" data-id="${p.id}">Ver cuotas</button></td>
    `;
    tbody.appendChild(tr);
    const exp = document.createElement("tr");
    exp.style.display = "none";
    exp.id = "exp_"+p.id;
    // ¡AQUÍ LA CORRECCIÓN CLAVE! ASEGURAR LA INTERPOLACIÓN CORRECTA DEL ID
    exp.innerHTML = `<td colspan="10"><div id="expbody_${p.id}">—</div></td>`; 
    tbody.appendChild(exp);
  }
  
  // Re-asignar los event listeners después de que el tbody ha sido actualizado
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
          
          const estado = cd.pagada ? "Pagada" : (cd.pagado_parcial ? `Parcial (${money(cd.pagado_parcial)})` : "Pendiente");
          const btnTxt = cd.pagada ? 'Desmarcar' : 'Marcar pagada';
          const btnCls = cd.pagada ? 'btn-danger' : 'btn-success';
          html += `<div class="d-flex justify-content-between align-items-center border p-2 mb-1">
            <div>Cuota ${cd.numero} — $${money(cd.monto)} — <small>${estado}</small></div>
            <div><button class="btn btn-sm ${btnCls} btn-toggle-cuota" data-qid="${c_id}" data-pid="${pid}">${btnTxt}</button></div>
          </div>`;
        }
        html += `</div>`;
        body.innerHTML = html;
        expRow.style.display = "";
        
        // También re-asignar los listeners de las cuotas
        body.querySelectorAll(".btn-toggle-cuota").forEach(bt => {
          bt.onclick = async (e2) => {
            const qid = e2.target.dataset.qid;
            const cuotaRef = doc(db,"cuotas", qid);
            const isMark = e2.target.textContent.trim() === 'Marcar pagada';
            await updateDoc(cuotaRef, { pagada: isMark });
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
const cliSnap2 = await getDocs(collection(db,"clientes"));

const montosPorCliente = {};
cliSnap2.forEach(c => montosPorCliente[c.id]=0);

presSnap2.forEach(p=>{
  const d=p.data();
  montosPorCliente[d.clienteId]=(montosPorCliente[d.clienteId]||0)+Number(d.monto||0);
});

const totalPrestamosClientes = Object.values(montosPorCliente).reduce((a,b)=>a+b,0);
const nombresClientes = [];
const valoresPrestamos = [];

for(const [cid,monto] of Object.entries(montosPorCliente)){
  if(monto>0){
    const nombre = cliSnap2.docs.find(d=>d.id===cid)?.data().nombre || cid;
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


// ---------- INICIAL ----------
await loadClients();
await loadPrestamosList();
await populatePrestamosSelect();
await loadAbonos();
await refreshHistorial();
await refreshDashboard();