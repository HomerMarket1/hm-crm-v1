// src/hooks/useSalesData.js
import { useMemo } from 'react';

// Normalizador de texto (mayúsculas/tildes)
const normalizeText = (text) => {
    if (!text) return '';
    return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export const useSalesData = (sales, catalog, allClients, uiState, currentFormData) => {
    const { filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;

    const NON_BILLABLE = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED', 'Vencido', 'Cancelado', 'Problemas', 'Garantía', 'Admin'];

    // ========================================================================
    // 2. HELPER DE FECHA (BLINDADO) 🛡️
    // ========================================================================
    const getDaysRemaining = (endDate) => {
        if (!endDate || typeof endDate !== 'string' || !endDate.includes('-')) return 0;
        try {
            const today = new Date(); 
            today.setHours(0,0,0,0); 
            const parts = endDate.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; 
            const day = parseInt(parts[2], 10);
            const end = new Date(year, month, day); 
            const diffTime = end - today;
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        } catch (e) { return 0; }
    };

    // ========================================================================
    // 3. FILTRADO PRINCIPAL
    // ========================================================================
    const filteredSales = useMemo(() => {
        if (!sales) return []; 
        
        return sales.filter(sale => {
            // A. FILTRO TEXTO
            if (filterClient) {
                const term = normalizeText(filterClient);
                const matchName = normalizeText(sale.client).includes(term);
                const matchEmail = normalizeText(sale.email).includes(term);
                const matchPhone = normalizeText(sale.phone).includes(term); 
                if (!matchName && !matchEmail && !matchPhone) return false;
            }
            // B. FILTRO SERVICIO
            if (filterService !== 'Todos' && sale.service !== filterService) return false;
            
            // C. FILTRO ESTADO
            if (filterStatus !== 'Todos') {
                const isFree = sale.client === 'LIBRE';
                const isProblem = NON_BILLABLE.some(s => s.toLowerCase() === (sale.client || '').toLowerCase());
                
                if (filterStatus === 'Libres' && !isFree) return false;
                if (filterStatus === 'Ocupados' && (isFree || isProblem)) return false;
                if (filterStatus === 'Problemas' && !isProblem) return false;
                if (filterStatus === 'Vencidos') {
                    if (!sale.endDate || isFree || isProblem) return false;
                    if (getDaysRemaining(sale.endDate) >= 0) return false; 
                }
            }
            
            // D. FILTRO FECHA (CORREGIDO PARA BÚSQUEDA EXACTA) ✅
            if (dateFrom || dateTo) {
                if (!sale.endDate) return false;
                
                // Caso 1: Usuario solo puso la primera fecha -> Busca coincidencia EXACTA
                if (dateFrom && !dateTo) {
                    if (sale.endDate !== dateFrom) return false;
                }
                // Caso 2: Usuario puso rango (o solo fecha fin) -> Busca en el intervalo
                else {
                    if (dateFrom && sale.endDate < dateFrom) return false;
                    if (dateTo && sale.endDate > dateTo) return false;
                }
            }

            return true;
        });
    }, [sales, filterClient, filterService, filterStatus, dateFrom, dateTo]);

    // ========================================================================
    // 4. CÁLCULOS AGREGADOS
    // ========================================================================
    const totalFilteredMoney = useMemo(() => filteredSales.reduce((sum, s) => {
        const isFree = s.client === 'LIBRE';
        const isProblem = NON_BILLABLE.some(st => st.toLowerCase() === (s.client || '').toLowerCase());
        if (isFree || isProblem) return sum;
        return sum + (Number(s.cost) || 0);
    }, 0), [filteredSales]);

    const totalItems = filteredSales.length;

    const getClientPreviousProfiles = useMemo(() => {
        if (!currentFormData.client || currentFormData.client === 'LIBRE') return [];
        return sales
            .filter(s => s.client === currentFormData.client && s.profile)
            .map(s => ({ profile: s.profile, pin: s.pin }))
            .filter((v, i, a) => a.findIndex(t => t.profile === v.profile) === i);
    }, [sales, currentFormData.client]);

    const accountsInventory = useMemo(() => {
        const groups = {};
        sales.forEach(s => {
            const key = `${s.email}|${s.pass}`;
            if (!groups[key]) groups[key] = { email: s.email, pass: s.pass, service: s.service, total: 0, free: 0, id: s.id, ids: [] };
            groups[key].total++;
            if (s.client === 'LIBRE') groups[key].free++;
            groups[key].ids.push(s.id);
        });
        return Object.values(groups);
    }, [sales]);

    const maxAvailableSlots = useMemo(() => {
        if (!currentFormData.service || !currentFormData.email) return 5;
        return sales.filter(s => s.email === currentFormData.email && s.service === currentFormData.service && s.client === 'LIBRE').length;
    }, [sales, currentFormData.service, currentFormData.email]);

    const packageCatalog = useMemo(() => catalog ? catalog.filter(s => s.type === 'Paquete') : [], [catalog]);

    // Visual Helpers
    const getStatusIcon = (serviceName) => {
        const lower = serviceName ? serviceName.toLowerCase() : '';
        if (lower.includes('netflix')) return 'N';
        if (lower.includes('disney')) return 'D';
        if (lower.includes('max') || lower.includes('hbo')) return 'M';
        if (lower.includes('prime') || lower.includes('amazon')) return 'P';
        if (lower.includes('paramount')) return 'P+';
        if (lower.includes('vix')) return 'V';
        if (lower.includes('plex')) return 'PX';
        if (lower.includes('iptv')) return 'TV';
        if (lower.includes('magis')) return 'MG';
        if (lower.includes('crunchyroll')) return 'CR';
        if (lower.includes('spotify')) return 'S';
        if (lower.includes('youtube')) return 'Y';
        return 'S';
    };

    const getStatusColor = (endDate, client) => {
        if (client === 'LIBRE') return 'bg-emerald-100 text-emerald-600 border border-emerald-200';
        if (NON_BILLABLE.some(s => s.toLowerCase() === (client || '').toLowerCase())) return 'bg-gray-100 text-gray-500 border border-gray-200';
        
        if (!endDate) return 'bg-slate-100 text-slate-500'; 
        
        const days = getDaysRemaining(endDate);
        if (days < 0) return 'bg-rose-100 text-rose-600 border border-rose-200'; 
        if (days <= 3) return 'bg-amber-100 text-amber-600 border border-amber-200'; 
        return 'bg-blue-50 text-blue-600 border border-blue-200'; 
    };

    // Listas Alertas
    const isBillable = (s) => {
        if (s.client === 'LIBRE') return false;
        if (!s.endDate) return false;
        if (NON_BILLABLE.some(status => status.toLowerCase() === s.client.toLowerCase())) return false;
        return true;
    };

    const expiringToday = useMemo(() => sales.filter(s => isBillable(s) && getDaysRemaining(s.endDate) === 0), [sales]);
    const expiringTomorrow = useMemo(() => sales.filter(s => isBillable(s) && getDaysRemaining(s.endDate) === 1), [sales]);
    const overdueSales = useMemo(() => sales.filter(s => isBillable(s) && getDaysRemaining(s.endDate) < 0), [sales]);

    return {
        filteredSales, totalFilteredMoney, totalItems, getClientPreviousProfiles, maxAvailableSlots,
        accountsInventory, packageCatalog, getStatusIcon, getStatusColor,
        getDaysRemaining, 
        expiringToday, expiringTomorrow, overdueSales
    };
};