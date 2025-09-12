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

// Clientes
document.getElementById("clienteForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = document.getElementById("clienteNombre").value;
  const telefono = document.getElementById("clienteTelefono").value;
  await addDoc(collection(db, "clientes"), { nombre, telefono });
  alert("Cliente agregado");
  document.getElementById("clienteForm").reset();
  cargarClientes();
  cargarClientesEnSelect();
});
async function cargarClientes() {
  const contenedor = document.getElementById("listaClientes");
  contenedor.innerHTML = "";
  const snap = await getDocs(collection(db, "clientes"));
  snap.forEach(docu => {
    const d = docu.data();
    contenedor.innerHTML += `<li class="list-group-item"><strong>${d.nombre}</strong> - ${d.telefono}</li>`;
  });
}
async function cargarClientesEnSelect() {
  const select = document.getElementById("historialSelect");
  select.innerHTML = `<option value="">Seleccione un cliente</option>`;
  const snap = await getDocs(collection(db, "clientes"));
  snap.forEach(docu => {
    const d = docu.data();
    select.innerHTML += `<option value="${docu.id}">${d.nombre}</option>`;
  });
}

// Prestamos
document.getElementById("prestamoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const clienteId = document.getElementById("prestamoCliente").value;
  const monto = parseFloat(document.getElementById("prestamoMonto").value);
  const cuotas = parseInt(document.getElementById("prestamoCuotas").value);
  const banco = document.getElementById("prestamoBanco").value;
  const observacion = document.getElementById("prestamoObservacion").value;
  const prestamoRef = await addDoc(collection(db, "prestamos"), { clienteId, monto, cuotas, banco, observacion, fecha: new Date() });
  for (let i = 1; i <= cuotas; i++) {
    await addDoc(collection(db, "cuotas"), { prestamoId: prestamoRef.id, numero: i, monto: monto/cuotas, pagada: false });
  }
  alert("Préstamo registrado");
  document.getElementById("prestamoForm").reset();
  cargarPrestamos();
});
async function cargarPrestamos() {
  const cont = document.getElementById("listaPrestamos");
  cont.innerHTML = "";
  const snap = await getDocs(collection(db, "prestamos"));
  for (const docu of snap.docs) {
    const d = docu.data();
    cont.innerHTML += `<li class="list-group-item">Cliente: ${d.clienteId} - Monto: ${d.monto} - Cuotas: ${d.cuotas}<br><small>Banco: ${d.banco} | Obs: ${d.observacion}</small></li>`;
  }
}

// Abonos
document.getElementById("abonoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const prestamoId = document.getElementById("abonoPrestamo").value;
  const monto = parseFloat(document.getElementById("abonoMonto").value);
  await addDoc(collection(db, "abonos"), { prestamoId, monto, fecha: new Date() });
  const q = query(collection(db, "cuotas"), where("prestamoId", "==", prestamoId), where("pagada", "==", false));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const cuota = snap.docs[0];
    await updateDoc(doc(db, "cuotas", cuota.id), { pagada: true });
  }
  alert("Abono registrado");
  document.getElementById("abonoForm").reset();
}

// Historial
document.getElementById("historialSelect").addEventListener("change", async (e) => {
  const clienteId = e.target.value;
  const cont = document.getElementById("historialCliente");
  cont.innerHTML = "";
  if (!clienteId) return;
  const q = query(collection(db, "prestamos"), where("clienteId", "==", clienteId));
  const snap = await getDocs(q);
  for (const prestamo of snap.docs) {
    const d = prestamo.data();
    cont.innerHTML += `<h5>Préstamo: ${d.monto} (${d.cuotas} cuotas)</h5>`;
    const qCuotas = query(collection(db, "cuotas"), where("prestamoId", "==", prestamo.id));
    const cuotasSnap = await getDocs(qCuotas);
    cuotasSnap.forEach(cuota => {
      const cd = cuota.data();
      cont.innerHTML += `<div class="d-flex justify-content-between border p-2 mb-1">
        <span>Cuota ${cd.numero}: ${cd.monto}</span>
        <button class="btn btn-sm ${cd.pagada ? 'btn-success':'btn-outline-secondary'}" onclick="marcarCuota('${cuota.id}', ${!cd.pagada})">${cd.pagada ? '✅ Pagada':'Marcar pagada'}</button>
      </div>`;
    });
  }
});
window.marcarCuota = async (idCuota, estado) => {
  await updateDoc(doc(db, "cuotas", idCuota), { pagada: estado });
  alert("Estado de cuota actualizado");
  document.getElementById("historialSelect").dispatchEvent(new Event("change"));
};

cargarClientes();
cargarClientesEnSelect();
cargarPrestamos();