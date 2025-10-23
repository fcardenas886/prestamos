import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

// ============================================================
// 🔧 CONFIGURACIÓN FIREBASE
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
const auth = getAuth(app);

// ============================================================
// 🛠️ UTILIDADES
// ============================================================
const $ = id => document.getElementById(id);

function showToast(message, type = 'success') {
  const container = document.querySelector('.toast-container');
  if (!container || typeof bootstrap === 'undefined') {
    alert(message);
    return;
  }
  
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
// 🔐 ESTADO Y ELEMENTOS DEL DOM
// ============================================================
let isRegisterMode = false;
const authForm = $("authForm");
const toggleRegisterBtn = $("toggleRegister");
const authTitle = $("authTitle");
const authButton = $("authButton");
const authFeedback = $("authFeedback");

// ============================================================
// 🚀 VERIFICAR SI YA ESTÁ AUTENTICADO
// ============================================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Usuario ya autenticado, redirigir al sistema principal
    showToast("✅ Sesión activa detectada. Redirigiendo...", 'info');
    setTimeout(() => {
      window.location.href = "index.html";
    }, 500);
  }
});

// ============================================================
// 🔄 ALTERNAR ENTRE LOGIN Y REGISTRO
// ============================================================
toggleRegisterBtn?.addEventListener("click", () => {
  isRegisterMode = !isRegisterMode;
  authTitle.textContent = isRegisterMode ? "🔐 Crear Nueva Cuenta" : "🔑 Iniciar Sesión";
  authButton.textContent = isRegisterMode ? "Registrar y Entrar" : "Iniciar Sesión";
  toggleRegisterBtn.textContent = isRegisterMode ? "¿Ya tienes cuenta? Inicia Sesión" : "¿No tienes cuenta? Regístrate";
  authFeedback.textContent = "";
  
  // Limpiar campos
  $("authEmail").value = "";
  $("authPassword").value = "";
});

// ============================================================
// 📝 MANEJAR ENVÍO DEL FORMULARIO
// ============================================================
authForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  authFeedback.textContent = "";

  // Validaciones
  if (!email || !password) {
    authFeedback.textContent = "⚠️ Por favor completa todos los campos.";
    return;
  }

  if (password.length < 6) {
    authFeedback.textContent = "⚠️ La contraseña debe tener al menos 6 caracteres.";
    return;
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    authFeedback.textContent = "⚠️ Por favor ingresa un correo válido.";
    return;
  }

  // Deshabilitar botón durante el proceso
  authButton.disabled = true;
  authButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

  try {
    if (isRegisterMode) {
      // REGISTRO
      await createUserWithEmailAndPassword(auth, email, password);
      showToast("🎉 ¡Registro exitoso! Bienvenido al sistema.", 'success');
    } else {
      // LOGIN
      await signInWithEmailAndPassword(auth, email, password);
      showToast("✅ ¡Bienvenido de vuelta!", 'success');
    }
    
    // La redirección se hace automáticamente por onAuthStateChanged
    
  } catch (error) {
    let errorMessage = "❌ Error: ";
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage += "No existe una cuenta con este correo.";
        break;
      case 'auth/wrong-password':
        errorMessage += "Contraseña incorrecta.";
        break;
      case 'auth/email-already-in-use':
        errorMessage += "Este correo ya está registrado. Intenta iniciar sesión.";
        break;
      case 'auth/invalid-email':
        errorMessage += "El formato del correo no es válido.";
        break;
      case 'auth/weak-password':
        errorMessage += "La contraseña es muy débil. Usa al menos 6 caracteres.";
        break;
      case 'auth/network-request-failed':
        errorMessage += "Error de conexión. Verifica tu internet.";
        break;
      case 'auth/too-many-requests':
        errorMessage += "Demasiados intentos. Espera unos minutos.";
        break;
      case 'auth/invalid-credential':
        errorMessage += "Credenciales inválidas. Verifica tu correo y contraseña.";
        break;
      default:
        errorMessage += `Ocurrió un error inesperado (${error.code})`;
        console.error("Error completo:", error);
    }
    
    authFeedback.textContent = errorMessage;
    showToast(errorMessage, 'danger');
    
  } finally {
    // Rehabilitar botón
    authButton.disabled = false;
    authButton.textContent = isRegisterMode ? "Registrar y Entrar" : "Iniciar Sesión";
  }
});

// ============================================================
// ⌨️ MEJORAS DE UX - Enter para enviar
// ============================================================
$("authPassword")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    authForm.dispatchEvent(new Event("submit"));
  }
});

console.log("✅ Sistema de autenticación cargado correctamente.");