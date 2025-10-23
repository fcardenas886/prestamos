import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, doc, updateDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { PushNotificationManager, NotificationScheduler } from './push_notifications.js';

// ============================================================
// 🔧 CONFIGURACIÓN Y GLOBALES
// ============================================================
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

// Estado global optimizado
const state = {
  currentUserId: null,
  clientsById: {},
  prestamosByUser: {},
  abonosByPrestamo: {},
  cuotasByPrestamo: {},
  abonosList: [],
  charts: { main: null, clientes: null }
};
const pushManager = new PushNotificationManager();
const notificationScheduler = new NotificationScheduler(pushManager);
window.pushManager = pushManager; // Exponer globalmente

// ============================================================
// 🛠️ UTILIDADES OPTIMIZADAS
// ============================================================
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2
}).format(Number(n || 0));

function showToast(message, type = 'success') {
  const container = document.querySelector('.toast-container');
  if (!container || typeof bootstrap === 'undefined') return console.error("Bootstrap Toast not found.");
  
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('data-bs-delay', '3000');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// ============================================================
// 🔔 SISTEMA DE NOTIFICACIONES DE CUOTAS
// ============================================================
class NotificationSystem {
  constructor() {
    this.lastCheck = null;
    this.notifications = [];
  }

  checkPendingPayments() {
    const hoy = dayjs().startOf('day');
    const notificaciones = [];
    
    for (const pid in state.prestamosByUser) {
      const p = state.prestamosByUser[pid];
      const cuotas = state.cuotasByPrestamo[pid] || [];
      const cliente = state.clientsById[p.clienteId];
      
      for (const c of cuotas) {
        if (c.pagada) continue;
        
        const fechaCuota = dayjs(c.vencimiento?.toDate?.() || c.vencimiento).startOf('day');
        const diffDias = fechaCuota.diff(hoy, 'day');
        
        // Vencidas
        if (diffDias < 0) {
          notificaciones.push({
            tipo: 'vencida',
            prioridad: 3,
            mensaje: `⚠️ Cuota #${c.numero} de ${cliente?.nombre || 'Cliente'} vencida hace ${Math.abs(diffDias)} días`,
            prestamoId: pid,
            cuotaId: c.id,
            dias: Math.abs(diffDias),
            monto: c.monto
          });
        }
        // Vencen hoy
        else if (diffDias === 0) {
          notificaciones.push({
            tipo: 'hoy',
            prioridad: 2,
            mensaje: `🔴 Cuota #${c.numero} de ${cliente?.nombre || 'Cliente'} vence HOY`,
            prestamoId: pid,
            cuotaId: c.id,
            dias: 0,
            monto: c.monto
          });
        }
        // Próximas 3 días
        else if (diffDias <= 3) {
          notificaciones.push({
            tipo: 'proxima',
            prioridad: 1,
            mensaje: `🟡 Cuota #${c.numero} de ${cliente?.nombre || 'Cliente'} vence en ${diffDias} día${diffDias > 1 ? 's' : ''}`,
            prestamoId: pid,
            cuotaId: c.id,
            dias: diffDias,
            monto: c.monto
          });
        }
      }
    }
    
    // Ordenar por prioridad
    notificaciones.sort((a, b) => b.prioridad - a.prioridad);
    this.notifications = notificaciones;
    this.renderNotifications();
    this.showBadge();
    this.updateIndicator();
  }

  updateIndicator() {
    const indicator = $('notificationIndicator');
    if (!indicator) return;
    
    if (this.notifications.length > 0) {
      const vencidas = this.notifications.filter(n => n.tipo === 'vencida').length;
      const hoy = this.notifications.filter(n => n.tipo === 'hoy').length;
      const proximas = this.notifications.filter(n => n.tipo === 'proxima').length;
      
      let mensaje = '🔔 ';
      if (vencidas > 0) mensaje += `${vencidas} vencida${vencidas > 1 ? 's' : ''} `;
      if (hoy > 0) mensaje += `${hoy} hoy `;
      if (proximas > 0) mensaje += `${proximas} próxima${proximas > 1 ? 's' : ''}`;
      
      indicator.innerHTML = `<span class="text-danger fw-bold">${mensaje}</span>`;
    } else {
      indicator.innerHTML = `<span class="text-success">✅ Sin alertas pendientes</span>`;
    }
  }

  renderNotifications() {
    let notifContainer = $('notificationPanel');
    if (!notifContainer) {
      notifContainer = document.createElement('div');
      notifContainer.id = 'notificationPanel';
      notifContainer.className = 'position-fixed top-0 end-0 p-3';
      notifContainer.style.cssText = 'z-index: 1050; max-width: 350px; margin-top: 70px;';
      document.body.appendChild(notifContainer);
    }

    if (this.notifications.length === 0) {
      notifContainer.innerHTML = '';
      return;
    }

    // Mostrar máximo 5 notificaciones
    const topNotifications = this.notifications.slice(0, 5);
    notifContainer.innerHTML = `
      <div class="card shadow-lg border-0">
        <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <span><strong>🔔 Alertas (${this.notifications.length})</strong></span>
          <button class="btn btn-sm btn-light" onclick="notificationSystem.dismissAll()">Ocultar</button>
        </div>
        <div class="card-body p-0" style="max-height: 400px; overflow-y: auto;">
          ${topNotifications.map(n => `
            <div class="alert alert-${n.tipo === 'vencida' ? 'danger' : n.tipo === 'hoy' ? 'warning' : 'info'} m-2 p-2 small" role="alert">
              ${n.mensaje}<br>
              <small>Monto: ${money(n.monto)}</small>
              <button class="btn btn-sm btn-outline-dark mt-1 w-100" onclick="notificationSystem.goToPrestamo('${n.prestamoId}')">
                Ver préstamo
              </button>
            </div>
          `).join('')}
          ${this.notifications.length > 5 ? `<p class="text-center text-muted small mb-2">+${this.notifications.length - 5} más...</p>` : ''}
        </div>
      </div>
    `;
  }

  showBadge() {
    let badge = $('notificationBadge');
    if (!badge) {
      badge = document.createElement('button');
      badge.id = 'notificationBadge';
      badge.className = 'btn btn-danger position-fixed';
      badge.style.cssText = 'top: 20px; right: 20px; z-index: 1051; border-radius: 50%; width: 50px; height: 50px;';
      badge.onclick = () => {
        const panel = $('notificationPanel');
        if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      };
      document.body.appendChild(badge);
    }

    if (this.notifications.length > 0) {
      badge.innerHTML = `🔔<br><small>${this.notifications.length}</small>`;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  dismissAll() {
    const panel = $('notificationPanel');
    if (panel) panel.style.display = 'none';
  }

  goToPrestamo(prestamoId) {
    this.dismissAll();
    const bsTab = new bootstrap.Tab($('tabs').querySelector(`[data-bs-target="#tab-prestamos"]`));
    bsTab.show();
    setTimeout(() => {
      const items = Array.from($('prestamosList').children || []);
      const item = items.find(it => it.textContent.includes(prestamoId));
      if (item) {
        item.classList.add('bg-warning');
        setTimeout(() => item.classList.remove('bg-warning'), 3000);
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  }
}

const notificationSystem = new NotificationSystem();
window.notificationSystem = notificationSystem;

// ============================================================
// 🔐 AUTENTICACIÓN
// ============================================================
$("btnLogout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);

    notificationScheduler.stop();

    showToast("Sesión cerrada correctamente.", 'success');
    window.location.href = "login.html";
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    showToast("No se pudo cerrar la sesión.", 'danger');
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    state.currentUserId = user.uid;
    const emailDisplay = $('userEmailDisplay');
    if (emailDisplay) emailDisplay.textContent = user.email;
    startApp();
  } else {
    // Si no hay usuario autenticado, redirigir a login
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('login.html') || currentPath === '/login.html';
    
    if (!isLoginPage) {
      console.log("🔒 Usuario no autenticado. Redirigiendo a login...");
      window.location.replace("login.html");
    }
  }
});

// ============================================================
// 📊 CÁLCULOS OPTIMIZADOS (Sin duplicación)
// ============================================================
function calcularSaldoPrestamo(prestamoId) {
  const cuotas = state.cuotasByPrestamo[prestamoId] || [];
  const totalPendiente = cuotas
    .filter(c => !c.pagada)
    .reduce((sum, c) => sum + (Number(c.monto) || 0) - (Number(c.pagado_parcial) || 0), 0);
  return totalPendiente;
}

function getPrestamoStatus(pid) {
  const p = state.prestamosByUser[pid];
  if (!p) return { status: 'desconocido', vencidas: 0, proximas: 0, dias: 9999, fecha: null };
  
  const saldoPendiente = calcularSaldoPrestamo(pid);
  if (saldoPendiente <= 0) return { status: 'saldado', vencidas: 0, proximas: 0, dias: 0, fecha: null };

  const cuotas = state.cuotasByPrestamo[pid] || [];
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

// ============================================================
// 🔄 LISTENERS OPTIMIZADOS
// ============================================================
async function startApp() {

  await initPushNotifications();

  loadClientsListener();
  loadAbonosListener();
  loadCuotasListener();
  loadPrestamosListener();
  
  // Verificar notificaciones cada 5 minutos
  notificationSystem.checkPendingPayments();
  setInterval(() => notificationSystem.checkPendingPayments(), 300000);

  notificationScheduler.start(state);

}

// 🔔 Inicializar sistema de notificaciones push
async function initPushNotifications() {
  const status = await pushManager.init();
  
  // Crear botón para solicitar permisos
  createPushNotificationButton(status);
  
  // Escuchar clics en notificaciones
  window.addEventListener('notification-click', (e) => {
    const { prestamoId, tipo } = e.detail;
    
    if (prestamoId) {
      notificationSystem.goToPrestamo(prestamoId);
    }
  });
}

// 🎛️ Crear botón de control de notificaciones push
function createPushNotificationButton(status) {
  const navbar = document.querySelector('.d-flex.justify-content-between');
  if (!navbar) return;
  
  const btnContainer = document.createElement('div');
  btnContainer.className = 'position-relative';
  
  const btn = document.createElement('button');
  btn.id = 'btnPushNotifications';
  btn.className = 'btn btn-sm btn-outline-primary';
  btn.innerHTML = '🔔 Notificaciones';
  
  const menu = document.createElement('div');
  menu.id = 'pushNotifMenu';
  menu.className = 'dropdown-menu dropdown-menu-end p-3';
  menu.style.cssText = 'min-width: 300px; display: none; position: absolute; right: 0; top: 100%; z-index: 1000;';
  
  const updateMenu = () => {
    const st = pushManager.getStatus();
    menu.innerHTML = `
      <h6 class="dropdown-header">⚙️ Configuración de Notificaciones</h6>
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span>Estado:</span>
          <span class="badge ${st.enabled ? 'bg-success' : 'bg-secondary'}">
            ${st.enabled ? '✅ Activas' : st.permission === 'denied' ? '❌ Bloqueadas' : '⚠️ Desactivadas'}
          </span>
        </div>
        ${!st.enabled && st.permission !== 'denied' ? `
          <button class="btn btn-primary btn-sm w-100 mb-2" id="btnRequestPush">
            Activar Notificaciones Push
          </button>
        ` : ''}
        ${st.permission === 'denied' ? `
          <div class="alert alert-warning p-2 small mb-2">
            Las notificaciones están bloqueadas. Ve a la configuración de tu navegador para activarlas.
          </div>
        ` : ''}
        <div class="form-check form-switch mb-2">
          <input class="form-check-input" type="checkbox" id="toggleSound" ${st.soundEnabled ? 'checked' : ''}>
          <label class="form-check-label" for="toggleSound">
            🔊 Sonido
          </label>
        </div>
        ${st.enabled ? `
          <button class="btn btn-outline-secondary btn-sm w-100 mb-2" id="btnTestPush">
            🧪 Probar Notificación
          </button>
          <button class="btn btn-outline-danger btn-sm w-100" id="btnCloseAllPush">
            🗑️ Cerrar Todas
          </button>
        ` : ''}
      </div>
      <hr>
      <small class="text-muted">
        ${st.enabled ? '✅ Recibirás alertas automáticas sobre cuotas vencidas y próximas a vencer.' : ''}
      </small>
    `;
    
    // Event listeners del menú
    menu.querySelector('#btnRequestPush')?.addEventListener('click', async () => {
      const granted = await pushManager.requestPermission();
      if (granted) {
        showToast('✅ Notificaciones push activadas correctamente', 'success');
        updateMenu();
      }
    });
    
    menu.querySelector('#toggleSound')?.addEventListener('change', (e) => {
      pushManager.toggleSound(e.target.checked);
      showToast(`🔊 Sonido ${e.target.checked ? 'activado' : 'desactivado'}`, 'info');
    });
    
    menu.querySelector('#btnTestPush')?.addEventListener('click', () => {
      pushManager.showTestNotification();
    });
    
    menu.querySelector('#btnCloseAllPush')?.addEventListener('click', () => {
      pushManager.closeAll();
      showToast('🗑️ Notificaciones cerradas', 'info');
    });
  };
  
  btn.onclick = () => {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    if (menu.style.display === 'block') updateMenu();
  };
  
  // Cerrar menú al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!btnContainer.contains(e.target)) {
      menu.style.display = 'none';
    }
  });
  
  btnContainer.appendChild(btn);
  btnContainer.appendChild(menu);
  navbar.appendChild(btnContainer);
}

function loadClientsListener() {
  const q = query(collection(db, "clientes"), where("userId", "==", state.currentUserId));
  onSnapshot(q, snap => {
    state.clientsById = {};
    snap.forEach(d => state.clientsById[d.id] = d.data());
    renderAllComponents();
  }, err => console.error("clients listener:", err));
}

function loadPrestamosListener() {
  const q = query(collection(db, "prestamos"), where("userId", "==", state.currentUserId));
  onSnapshot(q, snap => {
    state.prestamosByUser = {};
    snap.forEach(d => state.prestamosByUser[d.id] = { id: d.id, ...d.data() });
    renderAllComponents();
    notificationSystem.checkPendingPayments();
  }, err => console.error("prestamos listener:", err));
}

function loadAbonosListener() {
  const q = query(collection(db, "abonos"), where("userId", "==", state.currentUserId));
  onSnapshot(q, snap => {
    state.abonosByPrestamo = {};
    state.abonosList = [];
    for (const docu of snap.docs) {
      const d = { id: docu.id, ...docu.data() };
      state.abonosList.push(d);
      state.abonosByPrestamo[d.prestamoId] = (state.abonosByPrestamo[d.prestamoId] || 0) + (Number(d.monto) || 0);
    }
    state.abonosList.sort((a, b) => {
      const fa = a.fecha?.toDate?.() || new Date(a.fecha);
      const fb = b.fecha?.toDate?.() || new Date(b.fecha);
      return fb - fa;
    });
    renderAllComponents();
    renderUltimosAbonos();
  }, err => console.error("abonos listener:", err));
}

function loadCuotasListener() {
  const q = query(collection(db, "cuotas"));
  onSnapshot(q, snap => {
    state.cuotasByPrestamo = {};
    snap.forEach(d => {
      const data = d.data();
      (state.cuotasByPrestamo[data.prestamoId] ||= []).push({ id: d.id, ...data });
    });
    renderAllComponents();
    notificationSystem.checkPendingPayments();
  }, err => console.error("cuotas listener:", err));
}

// ============================================================
// 🎨 RENDERIZADO OPTIMIZADO
// ============================================================
function renderAllComponents() {
  renderClientList();
  loadPrestamosList();
  populatePrestamosSelect();
  refreshDashboard();
  refreshHistorial();
}

function renderClientList() {
  const list = $("clientesList");
  if (!list) return;
  list.innerHTML = "";
  const ids = Object.keys(state.clientsById);
  
  if (ids.length === 0) {
    list.innerHTML = '<li class="list-group-item text-center text-muted">No hay clientes registrados.</li>';
    return;
  }
  
  for (const cid of ids) {
    const d = state.clientsById[cid];
    const li = document.createElement('li');
    li.className = "list-group-item clickable-client";
    li.style.cursor = "pointer";
    li.innerHTML = `<strong>${d.nombre}</strong> — ${d.telefono || ''}`;
    li.addEventListener("click", () => showClientProfileModal(cid));
    list.appendChild(li);
  }
}

function loadPrestamosList() {
  $("prestamosList").innerHTML = "";
  const estadoFiltro = $("filtroEstadoPrestamo")?.value || 'todos';
  
  for (const pid in state.prestamosByUser) {
    const p = state.prestamosByUser[pid];
    const statusData = getPrestamoStatus(pid);
    if (estadoFiltro !== 'todos' && estadoFiltro !== statusData.status) continue;

    let borderClass = '';
    let estadoText = '';
    
    if (statusData.status === 'saldado') {
      borderClass = 'border-start border-4 border-success';
      estadoText = `<small class="text-success">✅ Saldado</small>`;
    } else if (statusData.status === 'vencido') {
      borderClass = 'border-start border-4 border-danger';
      const diasVencidos = Math.abs(statusData.dias);
      estadoText = `<small class="text-danger">🚨 VENCIDO HACE ${diasVencidos} DÍA(S)</small>`;
    } else if (statusData.status === 'proximo') {
      borderClass = 'border-start border-4 border-warning';
      const fechaStr = dayjs(statusData.fecha).format('DD/MM/YYYY');
      estadoText = `<small class="text-warning">⏰ Vence en ${statusData.dias} días (${fechaStr})</small>`;
    } else {
      borderClass = 'border-start border-4 border-primary';
      estadoText = `<small class="text-primary">Al día</small>`;
    }

    const clientName = state.clientsById[p.clienteId]?.nombre || p.clienteId;
    const fechaCreacion = p.fecha?.toDate ? p.fecha.toDate() : new Date(p.fecha || Date.now());
    const fechaStr = fechaCreacion.toLocaleDateString();
    
    $("prestamosList").innerHTML += `
      <li class="list-group-item ${borderClass}">
        <strong style="cursor:pointer;" class="text-decoration-underline" data-cid="${p.clienteId}" onclick="showClientProfileModal(this.dataset.cid)">Cliente: ${clientName}</strong> — Monto ${money(p.monto)} — Cuotas: ${p.cuotas}
        <br><small>ID Préstamo: ${pid} | Banco: ${p.banco || '-'} | Fecha: ${fechaStr}</small>
        <br>${estadoText}
      </li>`;
  }
}

function populatePrestamosSelect(clienteFiltro = '') {
  $("prestamoCliente").innerHTML = "<option value=''>Seleccione cliente</option>";
  $("filtroClienteAbono").innerHTML = "<option value=''>Filtrar por cliente (opcional)</option>";
  $("abonoPrestamo").innerHTML = "<option value=''>Seleccione préstamo</option>";

  for (const cid in state.clientsById) {
    const nombre = state.clientsById[cid].nombre;
    $("prestamoCliente").innerHTML += `<option value="${cid}">${nombre}</option>`;
    const isSelected = clienteFiltro === cid ? 'selected' : '';
    $("filtroClienteAbono").innerHTML += `<option value="${cid}" ${isSelected}>${nombre}</option>`;
  }

  for (const pid in state.prestamosByUser) {
    const p = state.prestamosByUser[pid];
    if (clienteFiltro && p.clienteId !== clienteFiltro) continue;
    
    const clientName = state.clientsById[p.clienteId]?.nombre || p.clienteId;
    const saldoPendiente = calcularSaldoPrestamo(pid);
    
    if (saldoPendiente <= 0) continue;
    
    const observacion = p.observacion ? ` | Obs: ${p.observacion}` : '';
    $("abonoPrestamo").innerHTML += `
      <option value="${pid}">
        ${clientName} — ${money(p.monto)} — SALDO: ${money(saldoPendiente)} ${observacion}
      </option>`;
  }
}

// ============================================================
// 📋 FORMULARIOS
// ============================================================
$("clienteForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = $("clienteNombre").value.trim();
  const telefono = $("clienteTelefono").value.trim();
  if (!nombre) return showToast("Nombre requerido", 'danger');
  
  try {
    await addDoc(collection(db, "clientes"), { 
      nombre, 
      telefono, 
      userId: state.currentUserId, 
      createdAt: new Date() 
    });
    $("clienteForm").reset();
    showToast(`Cliente ${nombre} registrado con éxito.`);
  } catch (error) {
    console.error("Error al registrar cliente:", error);
    showToast("Error al guardar cliente.", 'danger');
  }
});

$("prestamoForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const clienteId = $("prestamoCliente").value;
  const monto = parseFloat($("prestamoMonto").value);
  const interes = parseFloat($("prestamoInteres")?.value || 0);
  const cuotas = parseInt($("prestamoCuotas").value);
  const banco = $("prestamoBanco").value.trim();
  const observacion = $("prestamoObs").value.trim();
  
  if (!clienteId) return showToast("Seleccione cliente", 'danger');
  if (!monto || !cuotas) return showToast("Monto y cuotas requeridos", 'danger');
  if (monto <= 0) return showToast("El monto debe ser positivo.", 'danger');
  
  const montoConInteres = monto * (1 + (interes / 100));
  const montoCuota = Number((montoConInteres / cuotas).toFixed(2));
  const fechaBase = dayjs();
  
  try {
    const prestRef = await addDoc(collection(db, "prestamos"), { 
      clienteId, 
      monto, 
      interes, 
      cuotas, 
      montoTotalCuotas: montoConInteres, 
      banco, 
      observacion, 
      fecha: new Date(), 
      userId: state.currentUserId 
    });
    
    const cuotasBatch = [];
    for (let i = 1; i <= cuotas; i++) {
      const fechaV = fechaBase.add(i, 'month').toDate();
      cuotasBatch.push(addDoc(collection(db, "cuotas"), { 
        prestamoId: prestRef.id, 
        numero: i, 
        monto: montoCuota, 
        pagada: false, 
        pagado_parcial: 0, 
        vencimiento: fechaV 
      }));
    }
    await Promise.all(cuotasBatch);
    
    $("prestamoForm").reset();
    showToast(`Préstamo por ${money(monto)} registrado con éxito.`);
  } catch (error) {
    console.error("Error al registrar préstamo:", error);
    showToast("Error al registrar préstamo.", 'danger');
  }
});

$("abonoForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const prestamoId = $("abonoPrestamo").value;
  let montoAbono = parseFloat($("abonoMonto").value);
  
  if (!prestamoId || !montoAbono) return showToast("Seleccione préstamo e ingrese monto", 'danger');
  if (montoAbono <= 0) return showToast("El monto a abonar debe ser positivo.", 'danger');
  
  try {
    await runTransaction(db, async (transaction) => {
      const cuotasDocs = state.cuotasByPrestamo[prestamoId] || [];
      const saldoPendiente = calcularSaldoPrestamo(prestamoId);

      if (saldoPendiente <= 0) throw new Error("¡Este préstamo ya está saldado!");
      if (montoAbono > saldoPendiente) montoAbono = saldoPendiente;
      if (montoAbono <= 0) return;
      
      const abonoRef = doc(collection(db, "abonos"));
      transaction.set(abonoRef, { 
        prestamoId, 
        monto: montoAbono, 
        fecha: new Date(), 
        userId: state.currentUserId 
      });
      
      let restante = montoAbono;
      let cuotasOrdenadas = [...cuotasDocs].sort((a, b) => {
        const dateA = a.vencimiento?.toDate?.() || new Date(a.vencimiento);
        const dateB = b.vencimiento?.toDate?.() || new Date(b.vencimiento);
        return dateA - dateB;
      });
      
      for (const cdata of cuotasOrdenadas) {
        if (restante <= 0) break;
        const cuotaRef = doc(db, "cuotas", cdata.id);
        const montoCuota = Number(cdata.monto) || 0;
        const pagadoParcial = Number(cdata.pagado_parcial) || 0;
        const montoFaltante = montoCuota - pagadoParcial;
        
        if (cdata.pagada || montoFaltante <= 0) continue;
        
        if (restante >= montoFaltante) {
          transaction.update(cuotaRef, { pagada: true, pagado_parcial: 0 });
          restante -= montoFaltante;
        } else {
          transaction.update(cuotaRef, { pagado_parcial: pagadoParcial + restante });
          restante = 0;
        }
      }
    });
    
    $("abonoForm").reset();
    showToast(`Abono por ${money(montoAbono)} aplicado correctamente.`);
  } catch (e) {
    if (e.message && e.message.includes("saldado")) showToast(e.message, 'warning');
    else { 
      console.error("Fallo la transaccion:", e); 
      showToast("Error al procesar el abono.", 'danger'); 
    }
  }
});

// ============================================================
// 📊 DASHBOARD
// ============================================================
function refreshDashboard() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const lastMonth = (currentMonth + 11) % 12;
  let prestamosActual = 0, prestamosAnterior = 0;
  
  for (const pid in state.prestamosByUser) {
    const p = state.prestamosByUser[pid];
    const fecha = p.fecha?.toDate?.() || new Date(p.fecha || now);
    if (fecha.getMonth() === currentMonth) prestamosActual += Number(p.monto || 0);
    else if (fecha.getMonth() === lastMonth) prestamosAnterior += Number(p.monto || 0);
  }
  
  const totalAbonos = Object.values(state.abonosByPrestamo).reduce((a, b) => a + b, 0);
  $("dashTotalPrestamos").textContent = money(prestamosActual);
  $("dashTotalAbonos").textContent = money(totalAbonos);
  
  const trend = prestamosAnterior > 0 ? ((prestamosActual - prestamosAnterior) / prestamosAnterior) * 100 : (prestamosActual > 0 ? 100 : 0);
  $("dashPrestamosTrend").textContent = `${trend >= 0 ? '📈' : '📉'} ${Math.abs(trend).toFixed(1)}% vs mes anterior`;
  
  updateCuotaCounters();
  renderCharts(prestamosActual, prestamosAnterior);
}

function updateCuotaCounters() {
  const hoy = dayjs().startOf('day');
  let vencidas = 0, proximas = 0;
  
  for (const pid in state.prestamosByUser) {
    const cuotas = state.cuotasByPrestamo[pid] || [];
    for (const c of cuotas) {
      if (c.pagada) continue;
      const fechaV = dayjs(c.vencimiento?.toDate?.() || c.vencimiento).startOf('day');
      const diffDias = fechaV.diff(hoy, 'day');
      if (diffDias < 0) vencidas++;
      else if (diffDias >= 0 && diffDias <= 7) proximas++;
    }
  }
  
  $("dashCuotasVencidas").textContent = vencidas;
  $("dashCuotasPorVencer").textContent = proximas;
}

function renderCharts(prestamosActual, prestamosAnterior) {
  const ctx = $("dashChart")?.getContext("2d");
  if (ctx && typeof Chart !== 'undefined') {
    if (state.charts.main) state.charts.main.destroy();
    state.charts.main = new Chart(ctx, { 
      type: 'bar', 
      data: { 
        labels: ['Préstamos Act.', 'Préstamos Ant.'], 
        datasets: [{ 
          label: 'Préstamos', 
          data: [prestamosActual, prestamosAnterior],
          backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)']
        }] 
      }, 
      options: { 
        responsive: true, 
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { 
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return money(value);
              }
            }
          }
        }
      } 
    });
  }
  
  // Chart de distribución por cliente
  const montosPorCliente = {};
  for (const pid in state.prestamosByUser) { 
    const p = state.prestamosByUser[pid]; 
    montosPorCliente[p.clienteId] = (montosPorCliente[p.clienteId] || 0) + Number(p.monto || 0); 
  }
  
  const totalPrestamosClientes = Object.values(montosPorCliente).reduce((a, b) => a + b, 0);
  const nombresClientes = [], valoresPrestamos = [];
  
  for (const [cid, monto] of Object.entries(montosPorCliente)) {
    if (monto > 0) {
      const nombre = state.clientsById[cid]?.nombre || cid;
      const porcentaje = ((monto / totalPrestamosClientes) * 100).toFixed(1);
      nombresClientes.push(`${nombre} — ${money(monto)} (${porcentaje}%)`);
      valoresPrestamos.push(monto);
    }
  }
  
  const ctxClientes = $("dashChartClientes")?.getContext("2d");
  if (ctxClientes && typeof Chart !== 'undefined') {
    if (state.charts.clientes) state.charts.clientes.destroy();
    state.charts.clientes = new Chart(ctxClientes, { 
      type: 'doughnut', 
      data: { 
        labels: nombresClientes, 
        datasets: [{ 
          label: 'Monto total de préstamos', 
          data: valoresPrestamos 
        }] 
      }, 
      options: { 
        responsive: true, 
        plugins: { legend: { position: 'right' } } 
      } 
    });
  }
}

// ============================================================
// 📜 HISTORIAL
// ============================================================
function refreshHistorial() {
  const filterText = $("historialFiltro")?.value?.trim().toLowerCase() || '';
  const tbody = $("historialTable")?.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  for (const pid in state.prestamosByUser) {
    const p = state.prestamosByUser[pid];
    const clientName = state.clientsById[p.clienteId]?.nombre || p.clienteId;
    if (filterText && !clientName.toLowerCase().includes(filterText) && !p.clienteId.toLowerCase().includes(filterText)) continue;
    
    const saldo = calcularSaldoPrestamo(pid);
    const totalAb = state.abonosByPrestamo[pid] || 0;
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${pid}</td>
      <td>${clientName}</td>
      <td>${money(p.monto)}</td>
      <td>${Number(p.interes || 0).toFixed(2)}</td>
      <td>${p.cuotas}</td>
      <td>${money(totalAb)}</td>
      <td class="${saldo > 0 ? 'text-danger' : 'text-success'}"><b>${money(saldo)}</b></td>
      <td>${p.banco || ''}</td>
      <td>${p.observacion || ''}</td>
      <td><button class="btn btn-sm btn-outline-info btn-view" data-id="${pid}">Ver cuotas</button></td>`;
    tbody.appendChild(tr);
    
    const exp = document.createElement("tr");
    exp.style.display = "none";
    exp.id = "exp_" + pid;
    exp.innerHTML = `<td colspan="10"><div id="expbody_${pid}">—</div></td>`;
    tbody.appendChild(exp);
  }
  
  document.querySelectorAll(".btn-view").forEach(btn => {
    btn.onclick = async (ev) => {
      const pid = ev.target.dataset.id;
      const expRow = document.getElementById("exp_" + pid);
      const body = document.getElementById("expbody_" + pid);
      
      if (expRow.style.display === "none") {
        let cuotasOrdenadas = [...(state.cuotasByPrestamo[pid] || [])].sort((a, b) => {
          const dateA = a.vencimiento?.toDate?.() || new Date(a.vencimiento);
          const dateB = b.vencimiento?.toDate?.() || new Date(b.vencimiento);
          return dateA - dateB;
        });
        
        let html = `<div class="list-group">`;
        for (const cdata of cuotasOrdenadas) {
          const c_id = cdata.id;
          let estado;
          if (cdata.pagada) estado = "Pagada";
          else if (cdata.pagado_parcial && cdata.pagado_parcial > 0) estado = `Parcial (${money(cdata.pagado_parcial)})`;
          else estado = "Pendiente";
          
          const btnTxt = cdata.pagada ? 'Desmarcar' : 'Marcar pagada';
          const btnCls = cdata.pagada ? 'btn-danger' : 'btn-success';
          let vencimientoStr = "";
          try { 
            vencimientoStr = cdata.vencimiento?.toDate?.()?.toLocaleDateString() || new Date(cdata.vencimiento).toLocaleDateString(); 
          } catch (e) { 
            vencimientoStr = "N/A"; 
          }
          
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
            const cuotaRef = doc(db, "cuotas", qid);
            const isMark = e2.target.textContent.trim() === 'Marcar pagada';

            // Validación: no permitir marcar cuota si la anterior no está pagada
            const cuotas = (state.cuotasByPrestamo[pid] || []).sort((a, b) => (a.numero || 0) - (b.numero || 0));
            const idx = cuotas.findIndex(c => c.id === qid);
            if (isMark && idx > 0) {
              const anterior = cuotas[idx - 1];
              if (!anterior.pagada) {
                showToast(`⚠️ No puedes marcar la cuota ${cuotas[idx].numero} como pagada si la cuota ${anterior.numero} está pendiente.`, 'warning');
                return;
              }
            }

            const updateData = { 
              pagada: isMark, 
              pagado_parcial: isMark ? 0 : (state.cuotasByPrestamo[pid].find(c => c.id === qid)?.pagado_parcial || 0) 
            };
            if (!isMark) delete updateData.pagado_parcial;

            try {
              await updateDoc(cuotaRef, updateData);
            } catch (err) {
              console.error("Error al actualizar cuota:", err);
              showToast("No se pudo actualizar la cuota.", 'danger');
            }
          };
        });
      } else {
        expRow.style.display = "none";
      }
    };
  });
}

// ============================================================
// 🛠️ REGULARIZAR PRÉSTAMO
// ============================================================
$("btnRegularizarPrestamo")?.addEventListener("click", () => {
  const sel = $("regularizarPrestamo");
  sel.innerHTML = "";
  for (const pid in state.prestamosByUser) {
    const p = state.prestamosByUser[pid];
    const cliente = state.clientsById[p.clienteId]?.nombre || "Cliente desconocido";
    sel.innerHTML += `<option value="${pid}">${cliente} — ${money(p.monto)}</option>`;
  }
  new bootstrap.Modal($("regularizarModal")).show();
});

$("btnGuardarRegularizacion")?.addEventListener("click", async () => {
  const pid = $("regularizarPrestamo").value;
  const pagadas = parseInt($("regularizarPagadas").value || 0);
  const fechaInicio = new Date($("regularizarFechaInicio").value);
  if (!pid || !fechaInicio) return showToast("Seleccione préstamo y fecha válida", "danger");

  try {
    const cuotas = (state.cuotasByPrestamo[pid] || []).slice().sort((a, b) => (a.numero || 0) - (b.numero || 0));
    const nuevasFechas = cuotas.map((c, i) => {
      const f = new Date(fechaInicio);
      f.setMonth(f.getMonth() + i);
      return f;
    });

    for (let i = 0; i < cuotas.length; i++) {
      const c = cuotas[i];
      const cuotaRef = doc(db, "cuotas", c.id);
      await updateDoc(cuotaRef, {
        vencimiento: nuevasFechas[i],
        pagada: i < pagadas
      });
    }

    showToast("✅ Préstamo regularizado correctamente.", "success");
    bootstrap.Modal.getInstance($("regularizarModal"))?.hide();
  } catch (e) {
    console.error(e);
    showToast("Error al regularizar préstamo", "danger");
  }
});

// ============================================================
// 👤 PERFIL DE CLIENTE (MODAL)
// ============================================================
function showClientProfileModal(clientId) {
  const client = state.clientsById[clientId];
  if (!client) return showToast("Cliente no encontrado.", 'danger');
  
  const clientPrestamos = Object.values(state.prestamosByUser).filter(p => p.clienteId === clientId);
  let totalDue = 0, prestamosHtml = '';
  
  for (const p of clientPrestamos) {
    const saldoPendiente = calcularSaldoPrestamo(p.id);
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
      </div>`;
  }
  
  $('modalClientName').textContent = client.nombre;
  $('modalClientPhone').textContent = client.telefono || 'N/A';
  $('modalClientTotalDue').textContent = money(totalDue);
  $('modalClientPrestamosList').innerHTML = prestamosHtml || '<p class="text-center text-muted">No hay préstamos registrados para este cliente.</p>';

  $('modalBtnNewLoan').onclick = () => {
    const bsTab = new bootstrap.Tab($('tabs').querySelector(`[data-bs-target="#tab-prestamos"]`));
    bsTab.show();
    $('prestamoCliente').value = clientId;
    bootstrap.Modal.getInstance($('clientProfileModal'))?.hide();
  };
  
  $('modalBtnNewAbono').onclick = () => {
    const bsTab = new bootstrap.Tab($('tabs').querySelector(`[data-bs-target="#tab-abonos"]`));
    bsTab.show();
    $('filtroClienteAbono').value = clientId;
    populatePrestamosSelect(clientId);
    bootstrap.Modal.getInstance($('clientProfileModal'))?.hide();
  };
  
  const clientModal = new bootstrap.Modal($('clientProfileModal'));
  clientModal.show();
}
window.showClientProfileModal = showClientProfileModal;

// ============================================================
// 💰 ÚLTIMOS ABONOS
// ============================================================
function renderUltimosAbonos() {
  const ul = $("abonosList");
  if (!ul) return;
  ul.innerHTML = "";
  
  if (state.abonosList.length === 0) {
    ul.innerHTML = `<li class="list-group-item text-center text-muted">No hay abonos registrados.</li>`;
    return;
  }
  
  for (const abono of state.abonosList.slice(0, 10)) {
    const p = state.prestamosByUser[abono.prestamoId];
    const cliente = p ? (state.clientsById[p.clienteId]?.nombre || "Cliente desconocido") : "Sin préstamo";
    const fecha = abono.fecha?.toDate?.() || new Date(abono.fecha);
    const cuotas = (state.cuotasByPrestamo[abono.prestamoId] || []).slice().sort((a, b) => (a.numero || 0) - (b.numero || 0));
    const totalCuotas = cuotas.length;
    const siguiente = cuotas.find(c => !c.pagada);
    const nroCuota = siguiente ? siguiente.numero : totalCuotas || 0;
    const saldo = calcularSaldoPrestamo(abono.prestamoId);
    
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
      <span class="badge bg-success">OK</span>`;
    ul.appendChild(li);
  }
}

// Click en abono para ver detalles
document.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-abonoid]');
  if (!li) return;
  const abonoId = li.dataset.abonoid;
  const prestamoId = li.dataset.pid;
  handleAbonoClick(abonoId, prestamoId);
});

function handleAbonoClick(abonoId, prestamoId) {
  const abono = state.abonosList.find(a => a.id === abonoId) || {};
  const prestamo = state.prestamosByUser[prestamoId] || {};
  const cliente = prestamo ? state.clientsById[prestamo.clienteId] : null;
  const cuotas = (state.cuotasByPrestamo[prestamoId] || []).slice().sort((a, b) => (a.numero || 0) - (b.numero || 0));
  let cuotaAfectada = cuotas.find(c => Number(c.pagado_parcial) > 0 && !c.pagada)
    || cuotas.find(c => c.pagada && (c.numero === Math.max(...cuotas.filter(x => x.pagada).map(x => x.numero), 0)))
    || cuotas.find(c => !c.pagada);
  const saldo = calcularSaldoPrestamo(prestamoId);
  showAbonoDetailModal({ abono, prestamo, cliente, cuotaAfectada, cuotas, saldo });
}

function showAbonoDetailModal(data) {
  const { abono = {}, prestamo = {}, cliente = {}, cuotaAfectada, cuotas = [], saldo } = data;
  let modalEl = $('abonoDetailModal');
  
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'abonoDetailModal';
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">Detalle del Abono</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
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

  const body = modalEl.querySelector('#abonoDetailBody');
  const fecha = abono.fecha?.toDate?.() || new Date(abono.fecha || Date.now());
  const abonoMonto = money(abono.monto || 0);

  let cuotasHtml = '';
  if (cuotas.length === 0) {
    cuotasHtml = '<p class="text-muted text-center">No hay cuotas registradas.</p>';
  } else {
    cuotasHtml = '<div class="list-group list-group-flush">';
    for (const c of cuotas) {
      const venc = c.vencimiento?.toDate?.() || (c.vencimiento ? new Date(c.vencimiento) : null);
      const vencStr = venc ? venc.toLocaleDateString() : 'N/A';
      const estado = c.pagada ? 'Pagada' : (Number(c.pagado_parcial) > 0 ? `Parcial (${money(c.pagado_parcial)})` : 'Pendiente');
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

    <h6 class="border-bottom pb-2">Detalle de Cuotas (La marcada en rojo fue impactada)</h6>
    <div style="max-height: 300px; overflow-y: auto;">
      ${cuotasHtml}
    </div>`;

  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();

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
      const bsTab = new bootstrap.Tab($('tabs').querySelector(`[data-bs-target="#tab-prestamos"]`));
      bsTab.show();
      setTimeout(() => {
        const items = Array.from($('prestamosList').children || []);
        const item = items.find(it => it.textContent.includes(prestamo.id));
        if (item) { 
          item.classList.add('bg-warning'); 
          setTimeout(() => item.classList.remove('bg-warning'), 2500); 
          item.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
        }
      }, 200);
    } else showToast("No se encontró préstamo.", "warning");
  };
}

// ============================================================
// 🔧 EVENT LISTENERS ADICIONALES
// ============================================================
$("filtroClienteAbono")?.addEventListener("change", (e) => {
  populatePrestamosSelect(e.target.value);
});

$("abonoPrestamo")?.addEventListener("change", () => {
  const pid = $("abonoPrestamo").value;
  const infoBox = $("infoPrestamoAbono");
  if (!infoBox) return;
  
  if (!pid) { 
    infoBox.style.display = "none"; 
    return; 
  }
  
  const p = state.prestamosByUser[pid];
  if (!p) { 
    infoBox.innerHTML = "⚠️ Préstamo no encontrado."; 
    infoBox.style.display = "block"; 
    return; 
  }
  
  const cuotas = state.cuotasByPrestamo[pid] || [];
  const totalCuotas = cuotas.length;
  const siguienteCuota = cuotas.filter(c => !c.pagada).sort((a, b) => (a.numero || 0) - (b.numero || 0))[0];
  const valorCuota = siguienteCuota ? Number(siguienteCuota.monto) : 0;
  const nroCuota = siguienteCuota ? siguienteCuota.numero : totalCuotas;
  const saldo = calcularSaldoPrestamo(pid);
  
  infoBox.innerHTML = `
    <b>Próxima cuota:</b> ${siguienteCuota ? `#${nroCuota} — ${money(valorCuota)}` : '✅ Todas pagadas'}<br>
    <b>Saldo pendiente:</b> ${money(saldo)}<br>
    <b>Total de cuotas:</b> ${totalCuotas}`;
  infoBox.style.display = "block";
});

$("btnRefrescarHistorial")?.addEventListener("click", refreshHistorial);

document.querySelector('button[data-bs-target="#tab-dashboard"]')?.addEventListener('shown.bs.tab', () => { 
  refreshDashboard(); 
});

// ============================================================
// ✅ GLOBAL EXPORTS
// ============================================================
window.loadPrestamosList = loadPrestamosList;
console.log("✅ Sistema optimizado cargado correctamente.");