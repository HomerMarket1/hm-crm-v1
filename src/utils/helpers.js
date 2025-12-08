// src/utils/helpers.js

export const getDaysRemaining = (endDateString) => {
    if (!endDateString) return null;
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const [year, month, day] = endDateString.replace(/\//g, '-').split('-').map(Number);
    const endDate = new Date(year, month - 1, day); 
    endDate.setHours(0, 0, 0, 0); 
    const diffTime = endDate.getTime() - today.getTime();
    return Math.round(diffTime / MS_PER_DAY);
};

// NUEVA FUNCIÓN: LIMPIEZA AGRESIVA DE NOMBRES
export const cleanServiceName = (name) => {
    if (!name) return 'Servicio';
    // Elimina: "Paquete", "Cuenta", "Completa", "Perfiles", "Pantalla" y números asociados
    return name
        .replace(/(paquete|cuenta|completa|pantalla|perfil|perfiles|basic|standard|premium|\d+\s*perfiles)/gi, '')
        .replace(/\d+/g, '') // Elimina números sueltos (ej "4")
        .replace(/\+/g, '+ ') // Separa el + para que no quede pegado
        .trim();
};

export const formatList = (items) => {
    if (!items || items.length === 0) return '';
    const formatter = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });
    return formatter.format(items);
};

export const getWhatsAppUrl = (phone, message) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const baseUrl = isMobile ? "https://api.whatsapp.com/send" : "https://web.whatsapp.com/send";
    return `${baseUrl}?phone=${phone}&text=${encodeURIComponent(message)}`;
};

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

export const getServiceCategory = (serviceName) => {
    if (!serviceName) return 'UNKNOWN';
    const lower = serviceName.toLowerCase();
    if (lower.includes('disney') || lower.includes('star')) return 'Disney';
    if (lower.includes('netflix')) return 'Netflix';
    if (lower.includes('prime')) return 'Prime';
    if (lower.includes('max')) return 'Max';
    if (lower.includes('crunchyroll')) return 'Crunchyroll';
    if (lower.includes('vix')) return 'Vix';
    if (lower.includes('paramount')) return 'Paramount';
    return lower.split(' ')[0].replace('+', '');
};

export const findIndividualServiceName = (originalService, catalog) => {
    if (!originalService) return 'LIBRE 1 Perfil';
    const nameLower = originalService.toLowerCase();
    let serviceBase = '';
    
    if (nameLower.includes('netflix')) serviceBase = 'netflix';
    else if (nameLower.includes('disney')) serviceBase = 'disney';
    else if (nameLower.includes('prime')) serviceBase = 'prime';
    else if (nameLower.includes('max')) serviceBase = 'max';
    else if (nameLower.includes('star')) serviceBase = 'star';
    else if (nameLower.includes('paramount')) serviceBase = 'paramount';
    else if (nameLower.includes('crunchyroll')) serviceBase = 'crunchyroll';
    else if (nameLower.includes('vix')) serviceBase = 'vix';
    else serviceBase = nameLower.split(' ')[0].replace('+', '').trim();
    
    if (!Array.isArray(catalog) || catalog.length === 0) {
        return `${serviceBase.charAt(0).toUpperCase() + serviceBase.slice(1)} 1 Perfil`;
    }

    const individualService = catalog.find(s => 
        s.type === 'Perfil' && 
        Number(s.defaultSlots) === 1 && 
        s.name.toLowerCase().includes(serviceBase)
    );
    
    return individualService ? individualService.name : `${serviceBase.charAt(0).toUpperCase() + serviceBase.slice(1)} 1 Perfil`;
};

export const sendWhatsApp = (sale, actionType) => {
    if (!sale || !sale.phone) return;
    const type = actionType ? String(actionType).toLowerCase().trim() : 'default';
    const clientName = sale.client || 'Cliente';
    const serviceName = sale.service || sale.plataforma || 'servicio';
    const isFullAccount = !sale.profile || sale.profile === 'General' || sale.profile === 'Cuenta Completa';
    let message = '';
    
    if (type.includes('today')) message = `❌ Hola, ¡Tu perfil de ${serviceName} vence HOY! Por favor, realiza tu pago para no perder tu cupo ❌`;
    else if (type.includes('tomorrow')) message = `⚠️ Buen Día ${clientName}⚠️\nMañana vence su servicio de ${serviceName}.\n¿Renuevas un mes más?`;
    else if (type.includes('overdue')) message = `🔴 Hola, pago pendiente para ${serviceName}.`;
    else if (type.includes('sale') || type.includes('data')) {
        message = isFullAccount 
            ? `*${serviceName.toUpperCase()}*\nCORREO:\n${sale.email}\nCONTRASEÑA:\n${sale.pass}`
            : `*${serviceName.toUpperCase()} 1 PERFIL*\nCORREO:\n${sale.email}\nCONTRASEÑA:\n${sale.pass}\nPERFIL:\n${sale.profile}`;
    } else {
        message = `Hola, te escribo por tu servicio de ${serviceName}.`;
    }
    window.open(getWhatsAppUrl(sale.phone, message), '_blank');
};