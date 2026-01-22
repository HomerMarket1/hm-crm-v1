import { useMemo, useCallback } from 'react';

// --- CONSTANTES ---
const NON_BILLABLE = ['libre', 'caída', 'caida', 'actualizar', 'dominio', 'expired', 'vencido', 'cancelado', 'problemas', 'garantía', 'garantia', 'admin', 'stock', 'reposicion'];

const normalizeText = (text) => {
    if (!text) return '';
    return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// Mantenemos esta función SOLO para iconos y colores, NO para filtrar
const getPlatformBaseName = (serviceName) => {
    if (!serviceName) return 'Desconocido';
    const lower = serviceName.toLowerCase();
    if (lower.includes('disney')) return 'Disney+';
    if (lower.includes('netflix')) return 'Netflix';
    if (lower.includes('prime') || lower.includes('amazon')) return 'Prime Video';
    if (lower.includes('max') || lower.includes('hbo')) return 'Max';
    if (lower.includes('paramount')) return 'Paramount+';
    if (lower.includes('vix')) return 'Vix';
    if (lower.includes('plex')) return 'Plex';
    if (lower.includes('iptv') || lower.includes('magis')) return 'IPTV / Magis';
    if (lower.includes('crunchyroll')) return 'Crunchyroll';
    if (lower.includes('spotify')) return 'Spotify';
    if (lower.includes('youtube')) return 'YouTube';
    if (lower.includes('apple')) return 'Apple TV';
    return serviceName; 
};

const calculateDaysDiff = (endDateString, todayTimestamp) => {
    if (!endDateString || !endDateString.includes('-')) return 0;
    const [y, m, d] = endDateString.split('-').map(Number);
    const endTimestamp = new Date(y, m - 1, d).getTime(); 
    const diffTime = endTimestamp - todayTimestamp;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const useSalesData = (sales, catalog, allClients, uiState, currentFormData) => {
    const { filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;

    const todayAnchor = useMemo(() => {
        const t = new Date();
        t.setHours(0,0,0,0);
        return t.getTime();
    }, []);

    const getDaysRemaining = useCallback((endDate) => {
        return calculateDaysDiff(endDate, todayAnchor);
    }, [todayAnchor]);

    // --- MOTOR DE FILTRADO ---
    const filteredSales = useMemo(() => {
        if (!sales) return [];
        const term = filterClient ? normalizeText(filterClient) : '';
        const isFilteringService = filterService !== 'Todos';
        const isFilteringStatus = filterStatus !== 'Todos';
        const hasDateFilter = dateFrom || dateTo;
        const effectiveDateTo = (dateFrom && !dateTo) ? dateFrom : dateTo;

        return sales.filter(sale => {
            // A. Filtro Texto (Buscador)
            if (term) {
                const matchName = normalizeText(sale.client).includes(term);
                const matchEmail = normalizeText(sale.email).includes(term);
                const matchPhone = sale.phone ? normalizeText(sale.phone).includes(term) : false;
                const matchService = normalizeText(sale.service).includes(term);
                if (!matchName && !matchEmail && !matchPhone && !matchService) return false;
            }

            // ✅ B. FILTRO SERVICIO (LITERAL Y EXACTO)
            if (isFilteringService) {
                // Comparamos el texto exacto. Si en el filtro dice "Disney+ En Vivo",
                // la venta debe decir exactamente "Disney+ En Vivo".
                if (sale.service.trim() !== filterService.trim()) return false;
            }

            // C. Filtro Estado
            if (isFilteringStatus) {
                const clientLower = (sale.client || '').toLowerCase();
                const isFree = clientLower.includes('libre');
                const isProblem = NON_BILLABLE.some(s => clientLower.includes(s));
                const days = calculateDaysDiff(sale.endDate, todayAnchor);
                if (filterStatus === 'Libres' && !isFree) return false;
                if (filterStatus === 'Ocupados' && (isFree || isProblem)) return false;
                if (filterStatus === 'Problemas' && (!isProblem || isFree)) return false;
                if (filterStatus === 'Vencidos') {
                    if (isFree || isProblem || !sale.endDate) return false;
                    if (days >= 0) return false; 
                }
            }

            // D. Filtro Fecha
            if (hasDateFilter) {
                if (!sale.endDate) return false;
                const targetDate = String(sale.endDate).trim();
                const startLimit = dateFrom ? String(dateFrom).trim() : null;
                const endLimit = effectiveDateTo ? String(effectiveDateTo).trim() : null;

                if (startLimit && endLimit && startLimit === endLimit) {
                    if (targetDate !== startLimit) return false;
                } else {
                    if (startLimit && targetDate < startLimit) return false;
                    if (endLimit && targetDate > endLimit) return false;
                }
            }
            return true;
        });
    }, [sales, filterClient, filterService, filterStatus, dateFrom, dateTo, todayAnchor]);

    const totalFilteredMoney = useMemo(() => filteredSales.reduce((sum, s) => {
        const clientLower = (s.client || '').toLowerCase();
        if (NON_BILLABLE.some(st => clientLower.includes(st))) return sum;
        return sum + (Number(s.cost) || 0);
    }, 0), [filteredSales]);

    // ✅ INVENTARIO / BÓVEDA
    const accountsInventory = useMemo(() => {
        const groups = {};
        sales.forEach(s => {
            const exactService = s.service || 'Sin Servicio';
            const key = `${s.email}|${s.pass}|${exactService}`;
            
            if (!groups[key]) {
                groups[key] = { 
                    id: s.id, 
                    email: s.email, 
                    pass: s.pass, 
                    service: exactService, 
                    total: 0, 
                    free: 0,
                    ids: [] 
                };
            }
            
            groups[key].total++;
            if ((s.client || '').toLowerCase().includes('libre')) groups[key].free++;
            groups[key].ids.push(s.id);
        });
        
        return Object.values(groups).sort((a, b) => {
            if (b.free !== a.free) return b.free - a.free;
            return a.service.localeCompare(b.service);
        });
    }, [sales]);

    const getClientPreviousProfiles = useMemo(() => {
        if (!currentFormData.client || currentFormData.client === 'LIBRE') return [];
        return sales
            .filter(s => s.client === currentFormData.client && s.profile)
            .map(s => ({ profile: s.profile, pin: s.pin }))
            .filter((v, i, a) => a.findIndex(t => t.profile === v.profile) === i);
    }, [sales, currentFormData.client]);

    const maxAvailableSlots = useMemo(() => {
        if (!currentFormData.service || !currentFormData.email) return 5;
        return sales.filter(s => 
            s.email === currentFormData.email && 
            s.service === currentFormData.service && 
            (s.client || '').toLowerCase().includes('libre')
        ).length;
    }, [sales, currentFormData.service, currentFormData.email]);

    // --- HELPERS VISUALES ---
    const isBillable = useCallback((s) => {
        const c = (s.client || '').toLowerCase();
        if (c.includes('libre') || !s.endDate) return false;
        if (NON_BILLABLE.some(status => c.includes(status))) return false;
        return true;
    }, []);

    const { expiringToday, expiringTomorrow, overdueSales } = useMemo(() => {
        const today = []; const tomorrow = []; const overdue = [];
        sales.forEach(s => {
            if (!isBillable(s)) return;
            const days = calculateDaysDiff(s.endDate, todayAnchor);
            if (days < 0) overdue.push(s);
            else if (days === 0) today.push(s);
            else if (days === 1) tomorrow.push(s);
        });
        return { expiringToday: today, expiringTomorrow: tomorrow, overdueSales: overdue };
    }, [sales, todayAnchor, isBillable]);

    const getStatusIcon = useCallback((serviceName) => {
        const lower = serviceName ? serviceName.toLowerCase() : '';
        if (lower.includes('netflix')) return 'N';
        if (lower.includes('disney')) return 'D';
        if (lower.includes('max') || lower.includes('hbo')) return 'M';
        if (lower.includes('prime') || lower.includes('amazon')) return 'P';
        if (lower.includes('paramount')) return 'P+';
        if (lower.includes('vix')) return 'V';
        if (lower.includes('iptv')) return 'TV';
        if (lower.includes('apple')) return 'Ap';
        if (lower.includes('youtube')) return 'Y';
        if (lower.includes('spotify')) return 'S';
        return 'S';
    }, []);

    const getStatusColor = useCallback((endDate, client) => {
        const c = (client || '').toLowerCase();
        if (c.includes('libre')) return 'bg-emerald-100 text-emerald-600 border border-emerald-200';
        if (NON_BILLABLE.some(s => c.includes(s))) return 'bg-gray-100 text-gray-500 border border-gray-200';
        if (!endDate) return 'bg-slate-100 text-slate-500'; 
        const days = calculateDaysDiff(endDate, todayAnchor);
        if (days < 0) return 'bg-rose-100 text-rose-600 border border-rose-200'; 
        if (days <= 3) return 'bg-amber-100 text-amber-600 border border-amber-200'; 
        return 'bg-blue-50 text-blue-600 border border-blue-200'; 
    }, [todayAnchor]);

    // 🏆 CALCULADORA DE LEALTAD (NUEVA FUNCIÓN)
    const getClientLoyalty = useCallback((clientName) => {
        if (!clientName || !sales.length) return { level: 'Nuevo 🐣', color: 'text-slate-400 border-slate-400/20 bg-slate-400/10', months: 0 };

        const nameToSearch = normalizeText(clientName);
        
        // 1. Buscamos todas las ventas históricas de este cliente
        const clientHistory = sales.filter(s => normalizeText(s.client) === nameToSearch);
        
        if (clientHistory.length === 0) return { level: 'Nuevo 🐣', color: 'text-slate-400 border-slate-400/20 bg-slate-400/10', months: 0 };

        // 2. Encontramos la fecha de la PRIMERA compra (ordenamos ascendente)
        const sortedHistory = clientHistory.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : new Date().getTime();
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : new Date().getTime();
            return dateA - dateB;
        });

        const firstSaleDate = sortedHistory[0].createdAt ? new Date(sortedHistory[0].createdAt) : new Date();
        const now = new Date();

        // 3. Calculamos la diferencia en meses
        const diffTime = Math.abs(now - firstSaleDate);
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)); 

        // 4. Asignamos Nivel
        if (diffMonths >= 10) return { level: 'LEYENDA 👑', color: 'text-amber-400 border-amber-400/20 bg-amber-400/10', months: diffMonths };
        if (diffMonths >= 5) return { level: 'VIP 🌟', color: 'text-purple-400 border-purple-400/20 bg-purple-400/10', months: diffMonths };
        if (diffMonths >= 2) return { level: 'Fiel 🤝', color: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10', months: diffMonths };
        
        return { level: 'Nuevo 🐣', color: 'text-slate-400 border-slate-400/20 bg-slate-400/10', months: diffMonths };

    }, [sales]);

    return {
        filteredSales, totalFilteredMoney, totalItems: filteredSales.length, 
        getClientPreviousProfiles, maxAvailableSlots, accountsInventory, 
        packageCatalog: useMemo(() => catalog ? catalog.filter(s => s.type === 'Paquete') : [], [catalog]),
        getStatusIcon, getStatusColor, getDaysRemaining, 
        expiringToday, expiringTomorrow, overdueSales,
        getPlatformBaseName,
        getClientLoyalty // ✅ Exportamos la nueva función
    };
};