📂 Sistema de Gestión de Préstamos Web
Sistema de gestión para el control de clientes, registro de préstamos, cálculo de cuotas (incluyendo interés) y seguimiento de abonos y saldos pendientes. Desarrollado con HTML, Bootstrap y JavaScript, utilizando Firebase Firestore para la base de datos y Firebase Authentication para la seguridad de acceso.

🚀 Características Principales
Este proyecto está diseñado para ser una herramienta completa y segura para la administración de un portafolio de préstamos:

Autenticación Segura (Login/Registro): Acceso protegido a través de correo electrónico y contraseña (usando Firebase Auth) con un flujo de login separado en login.html.

Gestión de Clientes: CRUD básico para registrar y listar clientes por su nombre y teléfono.

Creación de Préstamos Avanzada:

Registro de monto principal, tasa de interés y número de cuotas.

Cálculo automático del monto total a pagar y el valor de la cuota fija.

Generación de fechas de vencimiento robustas (que evitan problemas como "31 de febrero").

Control de Abonos y Cuotas:

Registro de abonos que se aplican automáticamente a las cuotas pendientes, respetando el orden.

Soporte para pagos parciales.

Marcaje manual de cuotas como pagadas/pendientes.

Dashboard Visual: Paneles y gráficos (Chart.js) que muestran tendencias mensuales de préstamos y abonos, además de la distribución de préstamos por cliente.

Historial y Saldos: Vista de historial que muestra el saldo pendiente de cada préstamo, basado en el total adeudado menos los abonos realizados.

🛠️ Estructura del Proyecto
El proyecto se compone de los siguientes archivos principales:

Archivo	Descripción
index.html	Interfaz principal de la aplicación (Dashboard, Clientes, Préstamos, Historial).
main.js	Lógica central de la aplicación, manejo de pestañas, formularios de CRUD y conexión con Firestore.
login.html	Página de inicio de sesión y registro de nuevos usuarios.
login.js	Lógica de autenticación de usuarios y redirección a index.html.
style.css	Estilos CSS personalizados para la interfaz.
