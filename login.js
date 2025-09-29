import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

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

function $id(id){ return document.getElementById(id); }

// Función de Toast (Copia de main.js para mensajes en la página de login)
function showToast(message, type = 'success') {
  const container = document.querySelector('.toast-container');
  if (!container || typeof bootstrap === 'undefined' || !bootstrap.Toast) {
      console.error("Bootstrap Toast not found. Using alert fallback.");
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

let isRegisterMode = false;
const authForm = $id("authForm");
const toggleRegisterBtn = $id("toggleRegister");
const authTitle = $id("authTitle");
const authButton = $id("authButton");
const authFeedback = $id("authFeedback");

// 1. Verificar si el usuario ya está logeado (si es así, redirigir a index.html)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Redirigir a la aplicación principal
        window.location.href = "index.html"; 
    }
});


// 2. Lógica para alternar entre Login y Registro
toggleRegisterBtn.addEventListener("click", () => {
    isRegisterMode = !isRegisterMode;
    authTitle.textContent = isRegisterMode ? "Crear Nueva Cuenta" : "Iniciar Sesión";
    authButton.textContent = isRegisterMode ? "Registrar y Entrar" : "Iniciar Sesión";
    toggleRegisterBtn.textContent = isRegisterMode ? "¿Ya tienes cuenta? Inicia Sesión" : "¿No tienes cuenta? Regístrate";
    authFeedback.textContent = "";
});


// 3. Manejar el envío del formulario
authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $id("authEmail").value;
    const password = $id("authPassword").value;
    authFeedback.textContent = "";

    if (password.length < 6) {
        authFeedback.textContent = "La contraseña debe tener al menos 6 caracteres.";
        return;
    }

    try {
        if (isRegisterMode) {
            await createUserWithEmailAndPassword(auth, email, password);
            showToast("¡Registro exitoso! Redirigiendo...", 'success');
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("¡Bienvenido! Redirigiendo...", 'success');
        }
        // La redirección a index.html se activa por onAuthStateChanged
    } catch (error) {
        let errorMessage = "Error en la autenticación. ";
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage += "Correo o contraseña incorrectos.";
                break;
            case 'auth/email-already-in-use':
                errorMessage += "Este correo ya está registrado. Intenta iniciar sesión.";
                break;
            default:
                errorMessage += "Ocurrió un error inesperado. Código: " + error.code;
                console.error(error);
        }
        authFeedback.textContent = errorMessage;
    }
});