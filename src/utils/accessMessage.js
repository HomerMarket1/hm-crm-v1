// src/utils/accessMessage.js
// 📝 Mensaje de "datos de acceso" que se envía al cliente por WhatsApp.
// Lo usan el botón 🔒 del Tablero y el envío automático al registrar una venta.

export const cleanServiceName = (name) => name ? name.replace(/\s(Paquete|Perfil|Perfiles|Cuenta|Renovación|Pantalla|Dispositivo).*$/gi, '').trim() : '';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const formatDateWithYear = (endDate) => {
    if (!endDate || !endDate.includes('-')) return 'Indefinido';
    const [y, m, d] = endDate.split('-').map(Number);
    return `${d} de ${MONTHS[m - 1]} de ${y}`;
};

/** Mensaje al renovar: confirma el pago y la próxima fecha de vencimiento. */
export const buildRenewalMessage = (sale, newEndDate, brandName = 'HM Digital') => {
    const firstName = (sale.client || '').trim().split(' ')[0] || '';
    const serviceName = cleanServiceName(sale.service).replace(/\s+completa\b.*$/i, '').replace(/\s+\d+$/, '').toUpperCase();
    const isFull = sale.type === 'Cuenta' || /completa/i.test(sale.service || '');
    const detail = isFull ? 'CUENTA COMPLETA' : `1 PERFIL${sale.profile ? ` (${sale.profile})` : ''}`;
    return `✅ Hola ${firstName}, tu renovación de *${serviceName} ${detail}* quedó registrada.\n\n📅 Próximo vencimiento: *${formatDateWithYear(newEndDate)}*\n\n¡Gracias por confiar en ${brandName}! 🙌`;
};

const formatDate = (endDate) => {
    if (!endDate || !endDate.includes('-')) return 'Indefinido';
    const [, m, d] = endDate.split('-').map(Number);
    return `${d} de ${MONTHS[m - 1]}`;
};

/**
 * @param {object} sale  venta (service, type, email, pass, profile, pin, endDate)
 * @param {Array<{profile, pin}>} [profiles]  varios perfiles de la misma cuenta (venta múltiple / paquete)
 */
export const buildAccessMessage = (sale, profiles = null) => {
    // "Netflix Completa" -> NETFLIX · "Netflix 2 perfiles Paquete 2" -> NETFLIX
    const serviceName = cleanServiceName(sale.service).replace(/\s+completa\b.*$/i, '').replace(/\s+\d+$/, '').toUpperCase();
    const lowerService = serviceName.toLowerCase();
    const dateText = formatDate(sale.endDate);
    const isFull = sale.type === 'Cuenta';

    // IPTV: usuario/clave/DNS
    if (lowerService.includes('iptv') || lowerService.includes('magis') || lowerService.includes('tivify')) {
        return `${serviceName}\n\nUSUARIO:\n${sale.profile || 'N/A'}\nCONTRASEÑA:\n${sale.pin || 'N/A'}\nURL / DNS:\n${sale.pass || 'Solicitar'}\n\n☑️Su servicio vence el día ${dateText}☑️`;
    }

    const list = (profiles && profiles.length > 1) ? profiles : null;
    const isProtected = (lowerService.includes('netflix') || lowerService.includes('disney')) && !sale.type?.toLowerCase().includes('cuenta');

    // Varios perfiles de la misma cuenta en un solo mensaje
    if (list && !isFull) {
        const perfiles = list.map(p => `• ${p.profile || 'Perfil'} — PIN: ${p.pin || 'Sin PIN'}`).join('\n');
        return `${serviceName} ${list.length} PERFILES\n\nCORREO:\n${sale.email}\n${isProtected ? '' : `CONTRASEÑA:\n${sale.pass}\n`}PERFILES:\n${perfiles}\n\n${isProtected ? 'NOTA:\nPara activar, indícame si usarás TV, PC o Celular.\n\n' : ''}☑️Su servicio vence el día ${dateText}☑️`;
    }

    // Netflix / Disney por perfil: sin contraseña (se activa por código)
    if (isProtected) {
        return `${serviceName} 1 PERFIL\n\nCORREO:\n${sale.email}\nPERFIL:\n${sale.profile}\nPIN:\n${sale.pin || 'Sin PIN'}\n\nNOTA:\nPara activar, indícame si usarás TV, PC o Celular.\n\n☑️Su Perfil Vence el día ${dateText}☑️`;
    }

    const typeLabel = isFull ? 'CUENTA COMPLETA' : '1 PERFIL';
    return `${serviceName} ${typeLabel}\n\nCORREO:\n${sale.email}\nCONTRASEÑA:\n${sale.pass}\n${!isFull ? `PERFIL:\n${sale.profile}\nPIN:\n${sale.pin || 'Sin PIN'}\n` : ''}\n☑️Su Perfil Vence el día ${dateText}☑️`;
};
