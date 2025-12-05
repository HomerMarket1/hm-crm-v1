// src/utils/helpers.js

// Funciones para la Detección y Creación Dinámica del Enlace de WhatsApp
// ----------------------------------------------------------------------

/**
 * Determina el prefijo del enlace de WhatsApp basándose en si es un dispositivo móvil o PC.
 * @returns {string} El prefijo de URL: 'api' para móvil/tablet, 'web' para escritorio/PC.
 */
export const getWhatsappPrefix = () => {
    // Detecta pantallas estrechas (típicamente móvil) Y que usan puntero táctil (coarse pointer)
    const isMobileOrTablet = window.matchMedia("(max-width: 768px) and (pointer: coarse)").matches;
    
    if (isMobileOrTablet) {
        return "api"; // api.whatsapp.com (Mejor para abrir la app o la web en móvil)
    } else {
        return "web"; // web.whatsapp.com (Mejor para abrir la interfaz web en PC/escritorio)
    }
};

/**
 * Genera la URL base de WhatsApp con el prefijo correcto.
 * @param {string} phone - El número de teléfono.
 * @returns {string} La URL base (ej: https://api.whatsapp.com/send?phone=...)
 */
export const createWhatsappBaseUrl = (phone) => {
    const prefix = getWhatsappPrefix();
    
    // El formato de URL es el mismo, solo cambia el subdominio.
    return `https://${prefix}.whatsapp.com/send?phone=${phone}&text=`;
};


// Lógica de cálculo de días restantes (No necesita cambios)
// ----------------------------------------------------------------------

export const getDaysRemaining = (endDateStr) => {
    if (!endDateStr || typeof endDateStr !== 'string') return null;
    try {
        const [year, month, day] = endDateStr.split('-').map(Number);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const end = new Date(year, month - 1, day);
        return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    } catch (e) { return null; }
};

// Lógica de Agrupación de Servicios (Mantenido)
// ----------------------------------------------------------------------

export const getGroupedServicesMessage = (clientName, sales, catalog, targetDaysCondition) => {
    // La función interna `getDaysRemaining` se importa automáticamente en este archivo
    
    // El resto de la lógica sigue igual, pero ahora usa 'sales' y 'catalog' del argumento.
    const relevantSales = sales.filter(s => { 
        if (s.client !== clientName) return false; 
        const days = getDaysRemaining(s.endDate); 
        return targetDaysCondition(days); 
    });
    if (relevantSales.length === 0) return '';
    const serviceCounts = {};
    relevantSales.forEach(s => { 
        let cleanName = s.service.replace(/\s1\sPerfil$/i, '').trim(); 
        if (s.service.toLowerCase().includes('paquete')) {
            const packageDetails = catalog.find(p => p.name === s.service);
            cleanName = packageDetails ? packageDetails.name.replace(/ Paquete \d+ Perfiles/i, '') : s.service;
        }
        if (!serviceCounts[cleanName]) serviceCounts[cleanName] = 0; 
        serviceCounts[cleanName] += 1; 
    });
    
    const textParts = Object.keys(serviceCounts).map(name => { 
        const count = serviceCounts[name]; 
        const plural = count > 1 ? 'perfiles' : 'perfil'; 
        return `${name.toUpperCase()} ${count} ${plural.toUpperCase()}`; 
    });
    
    if (textParts.length === 1) return textParts[0];
    const last = textParts.pop();
    return `${textParts.join(', ')} y ${last}`;
};


// Lógica de WhatsApp (MODIFICADA para usar el prefijo dinámico)
// ----------------------------------------------------------------------

export const sendWhatsApp = (sale, catalog, sales, actionType) => {
    const dateText = sale.endDate ? sale.endDate.split('-').reverse().join('/') : ''; 
    let serviceUpper = sale.service.toUpperCase();
    let message = '';
    
    if (sale.service.toLowerCase().includes('paquete')) {
        serviceUpper = sale.service.toUpperCase().replace(/\s*PAQUETE\s*\d+\s*PERFILES/i, 'PAQUETE');
    }

    if (actionType === 'warning_tomorrow' || actionType === 'expired_today') {
        // La condición de los días se pasa a la función de ayuda
        const daysCondition = (d) => actionType === 'warning_tomorrow' ? d === 1 : d <= 0;
        
        // Ahora se usa la función helper y se le pasa sales y catalog
        const servicesList = getGroupedServicesMessage(sale.client, sales, catalog, daysCondition) || `${serviceUpper}`;
        
        let headerEmoji = actionType === 'warning_tomorrow' ? '⚠️' : '❌';
        let headerText = actionType === 'warning_tomorrow' ? 'Mañana vence su servicio de' : 'Su servicio de';
        let bodyText = actionType === 'warning_tomorrow' ? '¿Renuevas un mes más? Confirma cuando puedas.' : 'ha vencido *HOY*. Por favor confirma para renovar.';

        message = `${headerEmoji} Buen Día ${sale.client} ${headerEmoji}\n${headerText} *${servicesList}*.\n${bodyText}\n¡Gracias!`;
    } else if (actionType === 'account_details') {
        message = `*${serviceUpper}*\n\n*CORREO*:\n${sale.email}\n*CONTRASEÑA*:\n${sale.pass}\n\n☑️ Su Cuenta Vence el día ${dateText} ☑️`;
    } else if (actionType === 'profile_details') {
        message = `*${serviceUpper}*\n\nCORREO:\n${sale.email}\nCONTRASEÑA:\n${sale.pass}\nPERFIL:\n${sale.profile}\nPIN:\n${sale.pin}\n\n☑️ Su Perfil Vence el día ${dateText} ☑️`;
    }
    
    // *******************************************************************
    // LÓGICA MODIFICADA PARA USAR PREFIJO DINÁMICO
    // *******************************************************************
    const baseUrl = createWhatsappBaseUrl(sale.phone);
    window.open(`${baseUrl}${encodeURIComponent(message)}`, '_blank');
};