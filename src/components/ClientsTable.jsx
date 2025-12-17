import React from 'react';
import { getDaysRemaining } from '../utils/helpers'; // Importa tu helper

const ClientsTable = ({ data }) => { 
  // 'data' es tu array con TODOS los clientes y servicios (Netflix, Disney, etc.)

  const enviarRecordatorioUnificado = (servicioActual) => {
    const { cliente, telefono, fechaVencimiento } = servicioActual;

    // 1. Calculamos cuántos días faltan para ESTE servicio (ej. 1 = Mañana)
    const diasRestantes = getDaysRemaining(fechaVencimiento);

    // 2. Filtramos TODOS los servicios de este cliente que vencen en la MISMA fecha
    // Esto buscará a los "hermanos" (Disney, Prime) que venzan el mismo día.
    const serviciosCoincidentes = data.filter(item => 
      item.cliente === cliente && 
      getDaysRemaining(item.fechaVencimiento) === diasRestantes
    );

    // 3. Formateamos la lista de nombres (Ej: "Netflix, Disney y Prime")
    const nombresPlataformas = serviciosCoincidentes.map(s => s.plataforma); // o s.servicio
    const formateador = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });
    const listaTexto = formateador.format(nombresPlataformas);

    // 4. Definimos el mensaje según la urgencia
    let mensaje = '';
    
    if (diasRestantes === 0) {
      mensaje = `Hola *${cliente}*, hoy vencen tus servicios de: *${listaTexto}*. Recuerda renovar para no perder el acceso.`;
    } else if (diasRestantes === 1) {
      mensaje = `Hola *${cliente}*, te recordamos que MAÑANA vencen: *${listaTexto}*. Por favor gestionar el pago.`;
    } else {
      mensaje = `Hola *${cliente}*, tus servicios de *${listaTexto}* vencen en ${diasRestantes} días.`;
    }

    // 5. Construir URL de WhatsApp
    // Detecta si es móvil o PC para abrir la app correcta
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const baseUrl = isMobile 
      ? "https://api.whatsapp.com/send" 
      : "https://web.whatsapp.com/send";

    const url = `${baseUrl}?phone=${telefono}&text=${encodeURIComponent(mensaje)}`;

    // 6. Abrir WhatsApp
    window.open(url, '_blank');
  };

  return (
    <div>
      {/* Ejemplo de renderizado de tu tabla */}
      {data.map((row, index) => (
        <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <span>{row.cliente}</span>
          <span>{row.plataforma}</span>
          <span>{row.fechaVencimiento}</span>
          
          {/* BOTÓN: Al hacer click, ejecuta la lógica unificada */}
          <button onClick={() => enviarRecordatorioUnificado(row)}>
            Notificar WhatsApp
          </button>
        </div>
      ))}
    </div>
  );
};

export default ClientsTable;