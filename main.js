import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {"apiKey": "AIzaSyBDayetHZ2eoNjGnqcsqbZUqjQeS7WUiS0", "authDomain": "prestamos-43d7f.firebaseapp.com", "projectId": "prestamos-43d7f", "storageBucket": "prestamos-43d7f.firebasestorage.app", "messagingSenderId": "150090420052", "appId": "1:150090420052:web:7fe16cd94f7314e226c2c1"};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function $id(id){ return document.getElementById(id); }
function money(n){ return Number(n||0).toFixed(2); }

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
  for(const pdoc of snap.docs){
    const p = pdoc.data();
    $id("prestamosList").innerHTML += `<li class="list-group-item"><strong>Cliente ID:</strong> ${p.clienteId} — Monto ${money(p.monto)} — Cuotas: ${p.cuotas} <br><small>Banco: ${p.banco||'-'} | Obs: ${p.observacion||'-'}</small></li>`;
  }
  await populatePrestamosSelect();
}

async function populatePrestamosSelect(clienteFiltro=''){
  let q = collection(db,"prestamos");
  if(clienteFiltro) q = query(q, where("clienteId","==", clienteFiltro));
  const snap = await getDocs(q);
  $id("abonoPrestamo").innerHTML = "<option value=''>Seleccione préstamo</option>";
  for(const docu of snap.docs){
    const d = docu.data();
    $id("abonoPrestamo").innerHTML += `<option value="${docu.id}">${docu.id} — Cliente:${d.clienteId} — ${money(d.monto)}</option>`;
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

// register client
$id("clienteForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const nombre = $id("clienteNombre").value.trim();
  const telefono = $id("clienteTelefono").value.trim();
  if(!nombre) return alert("Nombre requerido");
  await addDoc(collection(db,"clientes"), { nombre, telefono });
  $id("clienteForm").reset();
  await loadClients();
});

// register loan
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
  const prestRef = await addDoc(collection(db,"prestamos"), { clienteId, monto, interes, cuotas, banco, observacion });
  for(let i=1;i<=cuotas;i++){
    await addDoc(collection(db,"cuotas"), { prestamoId: prestRef.id, numero:i, monto: Number((monto/cuotas).toFixed(2)), pagada:false });
  }
  $id("prestamoForm").reset();
  await loadPrestamosList();
});

// register abono
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
});

// filter prestamos for abonos by client
$id("filtroClienteAbono").addEventListener("change", async (e)=>{
  await populatePrestamosSelect(e.target.value);
});

// HISTORIAL
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
        let html = `<div class="list-group">`;
        for(const c of cuotasSnap.docs){
          const cd = c.data();
          const estado = cd.pagada ? "Pagada" : (cd.pagado_parcial ? `Parcial (${cd.pagado_parcial})` : "Pendiente");
          const btnTxt = cd.pagada ? 'Desmarcar' : 'Marcar pagada';
          const btnCls = cd.pagada ? 'btn-danger' : 'btn-success';
          html += `<div class="d-flex justify-content-between align-items-center border p-2 mb-1">
            <div>Cuota ${cd.numero} — $${money(cd.monto)} — <small>${estado}</small></div>
            <div><button class="btn btn-sm ${btnCls} btn-toggle-cuota" data-qid="${c.id}" data-pid="${pid}">${btnTxt}</button></div>
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
            await updateDoc(cuotaRef, { pagada: isMark });
            await refreshHistorial();
          };
        });
      } else {
        expRow.style.display = "none";
      }
    };
  });
}

$id("btnRefrescarHistorial").addEventListener("click", refreshHistorial);

// initial
await loadClients();
await loadPrestamosList();
await populatePrestamosSelect();
await loadAbonos();
await refreshHistorial();
