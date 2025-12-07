// =========================================================================
// FUNCIONES DE UTILIDAD GENERALES Y PÚBLICAS
// =========================================================================

// --- UTILIDADES DE FECHAS (Versión Estricta y Final) ---

export const getDaysRemaining = (endDateString) => {
    if (!endDateString) return null;

    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    const [year, month, day] = endDateString.split('-').map(Number);
    const endDate = new Date(year, month - 1, day); 
    endDate.setHours(0, 0, 0, 0); 

    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / MS_PER_DAY);
    
    return diffDays;
};


// --- UTILIDADES DE UI Y ESTADO ---

export const getStatusIcon = (clientName) => {
    if (clientName === 'LIBRE') return '✅';
    if (clientName === 'Caída') return '⚠️';
    if (clientName === 'Actualizar') return '🔄';
    if (clientName === 'Dominio') return '🌐';
    if (clientName === 'Admin') return '🛡️';
    if (clientName === 'EXPIRED') return '💀';
    return clientName.charAt(0);
};

export const getStatusColor = (clientName) => {
    if (clientName === 'LIBRE') return 'bg-emerald-100 text-emerald-600';
    if (clientName === 'Caída') return 'bg-red-100 text-red-600';
    if (clientName === 'Actualizar') return 'bg-blue-100 text-blue-600';
    if (clientName === 'Dominio') return 'bg-violet-100 text-violet-600';
    if (clientName === 'Admin') return 'bg-slate-800 text-white';
    if (clientName === 'EXPIRED') return 'bg-slate-200 text-slate-500';
    return 'bg-[#007AFF] text-white'; 
};

// --- UTILIDAD DE NEGOCIO (Categorización de Plataforma) ---

/**
 * Obtiene la categoría base (plataforma) de un servicio.
 * Mantiene la lógica robusta movida del SaleForm.
 */
export const getServiceCategory = (serviceName) => {
    if (!serviceName) return 'UNKNOWN';
    const lowerName = serviceName.toLowerCase();
    
    if (lowerName.includes('disney') || lowerName.includes('star')) return 'Disney';
    if (lowerName.includes('netflix')) return 'Netflix';
    if (lowerName.includes('prime')) return 'Prime';
    if (lowerName.includes('max')) return 'Max';
    if (lowerName.includes('crunchyroll')) return 'Crunchyroll';
    if (lowerName.includes('vix')) return 'Vix';
    if (lowerName.includes('paramount')) return 'Paramount';
    
    // Fallback: usar la primera palabra
    const base = lowerName.split(' ')[0].replace('+', '');
    return base;
};

// --- UTILIDAD DE NEGOCIO (Fragmentación) ---

export const findIndividualServiceName = (originalService, catalog) => {
    if (!originalService || !catalog) return 'LIBRE 1 Perfil (Error)';
    
    const nameLower = originalService.toLowerCase();
    let serviceBase;

    if (nameLower.includes('netflix')) serviceBase = 'netflix';
    else if (nameLower.includes('disney')) serviceBase = 'disney';
    else if (nameLower.includes('prime')) serviceBase = 'prime';
    else if (nameLower.includes('max')) serviceBase = 'max';
    else if (nameLower.includes('star')) serviceBase = 'star';
    else serviceBase = nameLower.split(' ')[0].replace('+', '');

    const individualService = catalog.find(s => 
        s.type === 'Perfil' && 
        Number(s.defaultSlots) === 1 && 
        s.name.toLowerCase().includes(serviceBase)
    );

    return individualService ? individualService.name : `${serviceBase.toUpperCase()} 1 Perfil (Error)`;
};


// --- UTILIDAD DE COMUNICACIÓN ---

export const sendWhatsApp = (sale, catalog, sales, actionType) => {
    if (!sale.phone) return;
    
    let message = "Hola, ";
    
    if (actionType === 'renew') {
        message += `te recuerdo que tu perfil de ${sale.service} vence pronto. ¿Deseas renovar?`;
    } else if (actionType === 'send_info') {
        message += `aquí están tus datos de acceso para ${sale.service}:\n\nEmail: ${sale.email}\nContraseña: ${sale.pass}\nPerfil: ${sale.profile}`;
    } else if (actionType === 'expired_today') {
        message += `¡Tu perfil de ${sale.service} vence HOY! Por favor, realiza tu pago para no perder tu cupo.`;
    } else if (actionType === 'warning_tomorrow') {
        message += `¡Alerta! Tu perfil de ${sale.service} vence MAÑANA. ¡Evita interrupciones y renueva hoy!`;
    } else if (actionType === 'overdue_payment') {
        message += `Hemos notado que tu pago por ${sale.service} está vencido. ¡Contáctanos para reactivar tu servicio!`;
    } else if (actionType === 'profile_details') {
        message += `Tus datos de perfil para ${sale.service}:\nEmail: ${sale.email}\nPerfil: ${sale.profile || 'General'}\nPIN: ${sale.pin || 'N/A'}`;
    } else if (actionType === 'account_details') {
         message += `Los datos de acceso general de tu cuenta son:\nEmail: ${sale.email}\nContraseña: ${sale.pass}`;
    }


    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${sale.phone}?text=${encodedMessage}`, '_blank');
};