// ============================================================
// 🔔 SISTEMA DE NOTIFICACIONES PUSH
// ============================================================

class PushNotificationManager {
  constructor() {
    this.permission = 'default';
    this.isSupported = 'Notification' in window;
    this.activeNotifications = new Map();
    this.soundEnabled = true;
    this.notificationSound = null;
    this.config = {
      icon: '💰',
      badge: '🔔',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      silent: false
    };
  }

  // 🎵 Inicializar sonido de notificación
  initSound() {
    // Puedes usar un archivo de audio o generar un beep
    this.notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuFzvLZiTYIGGW59+ibUBELTaXh8bllHgg2jdXx0Y0yBilruvG5dCgINHXD6+2kUhQIUKLh8bNgHQc1k+b00H8pCCJdsOu4Zy8COl6v6bldIg05UZbl7a5iKQgtb7vu0Z0+CSlruvLEfTUGNl+u6bRXIAs4V6vn66ZRDAo4VKXf7q5eIwk1Ta3n8KlZEwo3VKXf7rJeIgs1Sq7n7qdaDQo3VKXf7rNeIQk1S67m7adaDAo3VKXf7bNeIQk1S67m7adaDAo2VKXf7bNeIgg0TK7m7ahaDQo2VKXf7bJdIgg0TK7m7ahbDQo2U6Xf7bJdIgg0TK7m7alZDAo2U6Tf7bNeIgg0Ta7m7ahaDQo2U6Xf7bNeIQk1Ta7m7ahaDQo2U6Xf7rJeIgg0TK3n7adZDAo1Uqbf7bJdIgg0Ta3m7adZDAo1UqXf7bJdIgg0Ta7m7KdZDAk1U6Xf7bJdIgg0Ta7l7KdZDAk1U6Xf7bJdIgg0Ta7m7KdZDAk1U6Xf7bJdIgg0Ta7m7KdZDAk1U6Xf7bJdIgg0Ta7m7KdZDAk1U6Xf7bJdIgg0Ta7m7KdZDAk1U6Xf7bJdIgg0Ta7m7KdZDAk1U6Xf7bJdIgg0Ta7m7KdZDAk1U6Xf7bJdIgg0Ta7m7KdZDAk1U6Xf7bJdIgg0Ta7m7KdZDAk1U6Xf7bJdIgg0Ta7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk1U6Xf7bJdIgg0TK7m7KdZDAk=');
  }

  // ✅ Verificar soporte y permisos
  async init() {
    if (!this.isSupported) {
      console.warn('❌ Las notificaciones push no son soportadas en este navegador.');
      return false;
    }

    this.initSound();
    
    // Verificar permiso actual
    this.permission = Notification.permission;

    // Si ya está concedido, todo listo
    if (this.permission === 'granted') {
      console.log('✅ Notificaciones push habilitadas.');
      return true;
    }

    // Si está denegado, informar al usuario
    if (this.permission === 'denied') {
      console.warn('⚠️ Las notificaciones están bloqueadas. Ve a configuración del navegador.');
      return false;
    }

    // Si es default, no pedir permiso aún (esperar interacción del usuario)
    return null;
  }

  // 📢 Solicitar permiso (debe ser llamado por interacción del usuario)
  async requestPermission() {
    if (!this.isSupported) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        console.log('✅ Permiso de notificaciones concedido.');
        this.showTestNotification();
        return true;
      } else {
        console.warn('⚠️ Permiso de notificaciones denegado.');
        return false;
      }
    } catch (error) {
      console.error('Error al solicitar permiso:', error);
      return false;
    }
  }

  // 🧪 Notificación de prueba
  showTestNotification() {
    this.show({
      title: '🎉 ¡Notificaciones activadas!',
      body: 'Ahora recibirás alertas sobre cuotas vencidas y próximas.',
      tag: 'test-notification'
    });
  }

  // 📣 Mostrar notificación
  show(options) {
    if (!this.isSupported || this.permission !== 'granted') {
      console.warn('⚠️ No se pueden mostrar notificaciones. Permiso no concedido.');
      return null;
    }

    const {
      title = 'Sistema de Préstamos',
      body = '',
      tag = `notif-${Date.now()}`,
      data = {},
      actions = [],
      requireInteraction = this.config.requireInteraction,
      silent = this.config.silent
    } = options;

    const notificationOptions = {
      body,
      icon: this.config.icon,
      badge: this.config.badge,
      tag,
      data,
      vibrate: this.config.vibrate,
      requireInteraction,
      silent,
      actions: actions.length > 0 ? actions : undefined
    };

    try {
      const notification = new Notification(title, notificationOptions);
      
      // Guardar referencia
      this.activeNotifications.set(tag, notification);

      // Reproducir sonido personalizado si no es silenciosa
      if (!silent && this.soundEnabled && this.notificationSound) {
        this.notificationSound.play().catch(e => console.log('No se pudo reproducir sonido:', e));
      }

      // Event handlers
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) options.onClick(data);
      };

      notification.onclose = () => {
        this.activeNotifications.delete(tag);
        if (options.onClose) options.onClose();
      };

      notification.onerror = (error) => {
        console.error('Error en notificación:', error);
        this.activeNotifications.delete(tag);
      };

      // Auto-cerrar después de 10 segundos si no requiere interacción
      if (!requireInteraction) {
        setTimeout(() => notification.close(), 10000);
      }

      return notification;
    } catch (error) {
      console.error('Error al crear notificación:', error);
      return null;
    }
  }

  // 🚨 Notificación de cuota vencida
  notifyCuotaVencida(cuota, cliente, diasVencidos) {
    return this.show({
      title: `⚠️ Cuota Vencida - ${cliente}`,
      body: `Cuota #${cuota.numero} de ${this.formatMoney(cuota.monto)} lleva ${diasVencidos} día(s) vencida.`,
      tag: `vencida-${cuota.id}`,
      requireInteraction: true,
      data: { tipo: 'vencida', cuotaId: cuota.id, prestamoId: cuota.prestamoId },
      onClick: (data) => this.handleNotificationClick(data)
    });
  }

  // 🟡 Notificación de cuota próxima a vencer
  notifyCuotaProxima(cuota, cliente, diasRestantes) {
    return this.show({
      title: `⏰ Cuota Próxima - ${cliente}`,
      body: `Cuota #${cuota.numero} de ${this.formatMoney(cuota.monto)} vence en ${diasRestantes} día(s).`,
      tag: `proxima-${cuota.id}`,
      data: { tipo: 'proxima', cuotaId: cuota.id, prestamoId: cuota.prestamoId },
      onClick: (data) => this.handleNotificationClick(data)
    });
  }

  // 🔴 Notificación de cuota vence HOY
  notifyCuotaHoy(cuota, cliente) {
    return this.show({
      title: `🔴 VENCE HOY - ${cliente}`,
      body: `¡Cuota #${cuota.numero} de ${this.formatMoney(cuota.monto)} vence hoy!`,
      tag: `hoy-${cuota.id}`,
      requireInteraction: true,
      data: { tipo: 'hoy', cuotaId: cuota.id, prestamoId: cuota.prestamoId },
      onClick: (data) => this.handleNotificationClick(data)
    });
  }

  // 💰 Notificación de abono registrado
  notifyAbono(monto, cliente, saldoRestante) {
    return this.show({
      title: `✅ Abono Registrado - ${cliente}`,
      body: `Se registró abono de ${this.formatMoney(monto)}. Saldo restante: ${this.formatMoney(saldoRestante)}`,
      tag: `abono-${Date.now()}`,
      silent: false,
      data: { tipo: 'abono' }
    });
  }

  // 🎉 Notificación de préstamo saldado
  notifyPrestamoSaldado(cliente, montoTotal) {
    return this.show({
      title: `🎉 ¡Préstamo Saldado! - ${cliente}`,
      body: `El préstamo de ${this.formatMoney(montoTotal)} ha sido completamente pagado.`,
      tag: `saldado-${Date.now()}`,
      requireInteraction: false,
      data: { tipo: 'saldado' }
    });
  }

  // 🔄 Notificación de resumen diario
  notifyResumenDiario(vencidas, proximas, total) {
    return this.show({
      title: `📊 Resumen del Día`,
      body: `${vencidas} cuotas vencidas | ${proximas} próximas a vencer | Total pendiente: ${this.formatMoney(total)}`,
      tag: 'resumen-diario',
      requireInteraction: false
    });
  }

  // 🎯 Manejar clic en notificación
  handleNotificationClick(data) {
    console.log('Click en notificación:', data);
    
    // Aquí puedes navegar a la sección correspondiente
    if (data.prestamoId) {
      // Disparar evento personalizado para que main.js lo maneje
      window.dispatchEvent(new CustomEvent('notification-click', { 
        detail: data 
      }));
    }
  }

  // 💵 Formatear dinero
  formatMoney(amount) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(Number(amount || 0));
  }

  // 🔕 Activar/desactivar sonido
  toggleSound(enabled) {
    this.soundEnabled = enabled;
    localStorage.setItem('pushNotificationsSound', enabled);
  }

  // 🗑️ Cerrar todas las notificaciones activas
  closeAll() {
    this.activeNotifications.forEach(notification => notification.close());
    this.activeNotifications.clear();
  }

  // 📋 Obtener estado
  getStatus() {
    return {
      supported: this.isSupported,
      permission: this.permission,
      enabled: this.permission === 'granted',
      soundEnabled: this.soundEnabled,
      activeCount: this.activeNotifications.size
    };
  }
}

// ============================================================
// 📅 PROGRAMADOR DE NOTIFICACIONES
// ============================================================

class NotificationScheduler {
  constructor(pushManager) {
    this.pushManager = pushManager;
    this.intervals = {
      checkVencidas: null,      // Cada 30 minutos
      checkProximas: null,      // Cada 2 horas
      resumenDiario: null       // Una vez al día (9 AM)
    };
    this.lastChecks = {
      vencidas: null,
      proximas: null,
      resumen: null
    };
  }

  // ▶️ Iniciar programador
  start(state) {
    this.stop(); // Detener cualquier intervalo previo
    
    // Revisar cuotas vencidas cada 30 minutos
    this.intervals.checkVencidas = setInterval(() => {
      this.checkCuotasVencidas(state);
    }, 30 * 60 * 1000);

    // Revisar cuotas próximas cada 2 horas
    this.intervals.checkProximas = setInterval(() => {
      this.checkCuotasProximas(state);
    }, 2 * 60 * 60 * 1000);

    // Resumen diario a las 9 AM
    this.scheduleResumenDiario(state);

    // Ejecutar checks inmediatamente
    this.checkCuotasVencidas(state);
    this.checkCuotasProximas(state);

    console.log('✅ Programador de notificaciones iniciado.');
  }

  // ⏹️ Detener programador
  stop() {
    Object.keys(this.intervals).forEach(key => {
      if (this.intervals[key]) {
        clearInterval(this.intervals[key]);
        this.intervals[key] = null;
      }
    });
    console.log('⏹️ Programador de notificaciones detenido.');
  }

  // 🚨 Revisar cuotas vencidas
  checkCuotasVencidas(state) {
    if (!state || !state.cuotasByPrestamo || !state.prestamosByUser) return;

    const hoy = dayjs().startOf('day');
    const notificadas = new Set(JSON.parse(localStorage.getItem('cuotasVencidasNotificadas') || '[]'));

    for (const prestamoId in state.prestamosByUser) {
      const prestamo = state.prestamosByUser[prestamoId];
      const cliente = state.clientsById?.[prestamo.clienteId];
      const cuotas = state.cuotasByPrestamo[prestamoId] || [];

      for (const cuota of cuotas) {
        if (cuota.pagada) continue;

        const fechaCuota = dayjs(cuota.vencimiento?.toDate?.() || cuota.vencimiento).startOf('day');
        const diasVencidos = hoy.diff(fechaCuota, 'day');

        // Solo notificar cuotas vencidas hace 1, 3, 7, 15, 30 días
        if (diasVencidos > 0 && [1, 3, 7, 15, 30].includes(diasVencidos)) {
          const notifKey = `${cuota.id}-${diasVencidos}`;
          
          if (!notificadas.has(notifKey)) {
            this.pushManager.notifyCuotaVencida(
              cuota,
              cliente?.nombre || 'Cliente',
              diasVencidos
            );
            
            notificadas.add(notifKey);
            localStorage.setItem('cuotasVencidasNotificadas', JSON.stringify([...notificadas]));
          }
        }
      }
    }

    this.lastChecks.vencidas = new Date();
  }

  // ⏰ Revisar cuotas próximas
  checkCuotasProximas(state) {
    if (!state || !state.cuotasByPrestamo || !state.prestamosByUser) return;

    const hoy = dayjs().startOf('day');
    const notificadas = new Set(JSON.parse(localStorage.getItem('cuotasProximasNotificadas') || '[]'));

    for (const prestamoId in state.prestamosByUser) {
      const prestamo = state.prestamosByUser[prestamoId];
      const cliente = state.clientsById?.[prestamo.clienteId];
      const cuotas = state.cuotasByPrestamo[prestamoId] || [];

      for (const cuota of cuotas) {
        if (cuota.pagada) continue;

        const fechaCuota = dayjs(cuota.vencimiento?.toDate?.() || cuota.vencimiento).startOf('day');
        const diasRestantes = fechaCuota.diff(hoy, 'day');

        // Notificar si vence hoy
        if (diasRestantes === 0) {
          const notifKey = `${cuota.id}-hoy`;
          if (!notificadas.has(notifKey)) {
            this.pushManager.notifyCuotaHoy(cuota, cliente?.nombre || 'Cliente');
            notificadas.add(notifKey);
            localStorage.setItem('cuotasProximasNotificadas', JSON.stringify([...notificadas]));
          }
        }
        // Notificar 3 días antes
        else if (diasRestantes === 3) {
          const notifKey = `${cuota.id}-3dias`;
          if (!notificadas.has(notifKey)) {
            this.pushManager.notifyCuotaProxima(cuota, cliente?.nombre || 'Cliente', diasRestantes);
            notificadas.add(notifKey);
            localStorage.setItem('cuotasProximasNotificadas', JSON.stringify([...notificadas]));
          }
        }
        // Notificar 7 días antes
        else if (diasRestantes === 7) {
          const notifKey = `${cuota.id}-7dias`;
          if (!notificadas.has(notifKey)) {
            this.pushManager.notifyCuotaProxima(cuota, cliente?.nombre || 'Cliente', diasRestantes);
            notificadas.add(notifKey);
            localStorage.setItem('cuotasProximasNotificadas', JSON.stringify([...notificadas]));
          }
        }
      }
    }

    this.lastChecks.proximas = new Date();
  }

  // 📊 Programar resumen diario
  scheduleResumenDiario(state) {
    const ahora = new Date();
    const proximoResumen = new Date();
    proximoResumen.setHours(9, 0, 0, 0);

    // Si ya pasaron las 9 AM, programar para mañana
    if (ahora.getHours() >= 9) {
      proximoResumen.setDate(proximoResumen.getDate() + 1);
    }

    const msHastaResumen = proximoResumen - ahora;

    setTimeout(() => {
      this.enviarResumenDiario(state);
      
      // Reprogramar para el día siguiente
      setInterval(() => {
        this.enviarResumenDiario(state);
      }, 24 * 60 * 60 * 1000);
    }, msHastaResumen);

    console.log(`📅 Resumen diario programado para: ${proximoResumen.toLocaleString()}`);
  }

  // 📨 Enviar resumen diario
  enviarResumenDiario(state) {
    if (!state) return;

    const hoy = dayjs().startOf('day');
    let vencidas = 0;
    let proximas = 0;
    let totalPendiente = 0;

    for (const prestamoId in state.prestamosByUser) {
      const cuotas = state.cuotasByPrestamo[prestamoId] || [];
      
      for (const cuota of cuotas) {
        if (cuota.pagada) continue;

        const fechaCuota = dayjs(cuota.vencimiento?.toDate?.() || cuota.vencimiento).startOf('day');
        const diff = fechaCuota.diff(hoy, 'day');
        const montoPendiente = (cuota.monto || 0) - (cuota.pagado_parcial || 0);

        if (diff < 0) {
          vencidas++;
          totalPendiente += montoPendiente;
        } else if (diff <= 7) {
          proximas++;
          totalPendiente += montoPendiente;
        }
      }
    }

    this.pushManager.notifyResumenDiario(vencidas, proximas, totalPendiente);
    this.lastChecks.resumen = new Date();
  }
}

// ============================================================
// 🌐 EXPORTAR PARA USO EN MAIN.JS
// ============================================================
export { PushNotificationManager, NotificationScheduler };
