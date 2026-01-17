import { useMemo, useCallback } from 'react';

// --- ⚡️ CONSTANTES & HELPERS PUROS (Outside Context) ---
// Mantenemos consistencia con useDataSync
const NON_BILLABLE = ['libre', 'caída', 'caida', 'actualizar', 'dominio', 'expired', 'vencido', 'cancelado', 'problemas', 'garantía', 'garantia', 'admin', 'stock', 'reposicion'];

// Normalizador de texto optimizado (Memo-friendly)
const normalizeText = (text) => {
    if (!text) return '';
    return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// Detector de Plataforma Base (Para la Bóveda/Inventario)
const getPlatformBaseName = (serviceName) => {
    if (!serviceName) return 'Desconocido';
    const lower = serviceName.toLowerCase();
    
    // Orden de prioridad: De más específico a más general
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
    
    return serviceName; // Fallback
};

// Calculadora de días pura (trabaja con timestamps para velocidad)
const calculateDaysDiff = (endDateString, todayTimestamp) => {
    if (!endDateString || !endDateString.includes('-')) return 0;
    const [y, m, d] = endDateString.split('-').map(Number);
    // Mes en JS es 0-11
    const endTimestamp = new Date(y, m - 1, d).getTime(); 
    const diffTime = endTimestamp - todayTimestamp;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const useSalesData = (sales, catalog, allClients, uiState, currentFormData) => {
    // Desestructuramos para evitar re-renders por props fantasma
    const { filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;

    // 1. DATE ANCHOR (Calculamos "Hoy" una sola vez por render)
    const todayAnchor = useMemo(() => {
        const t = new Date();
        t.setHours(0,0,0,0);
        return t.getTime();
    }, []); // Se recalcula solo si se refresca el componente mayor

    // Helper memoizado para usar dentro del componente
    const getDaysRemaining = useCallback((endDate) => {
        return calculateDaysDiff(endDate, todayAnchor);
    }, [todayAnchor]);

    // ========================================================================
    // 2. MOTOR DE FILTRADO (Turbocharged) 🏎️
    // ========================================================================
    const filteredSales = useMemo(() => {
        if (!sales) return [];

        // Pre-procesamos filtros para no hacerlo en cada iteración
        const term = filterClient ? normalizeText(filterClient) : '';
        const isFilteringService = filterService !== 'Todos';
        const isFilteringStatus = filterStatus !== 'Todos';
        const hasDateFilter = dateFrom || dateTo;

        return sales.filter(sale => {
            // A. FILTRO TEXTO (Búsqueda Profunda)
            if (term) {
                const matchName = normalizeText(sale.client).includes(term);
                const matchEmail = normalizeText(sale.email).includes(term);
                const matchPhone = sale.phone ? normalizeText(sale.phone).includes(term) : false;
                const matchService = normalizeText(sale.service).includes(term); // Agregué servicio
                if (!matchName && !matchEmail && !matchPhone && !matchService) return false;
            }

            // B. FILTRO SERVICIO
            if (isFilteringService) {
                // Comparación laxa para atrapar variantes
                if (!sale.service.toLowerCase().includes(filterService.toLowerCase())) return false;
            }
            
            // C. FILTRO ESTADO (Lógica Blindada)
            if (isFilteringStatus) {
                const clientLower = (sale.client || '').toLowerCase();
                const isFree = clientLower.includes('libre');
                const isProblem = NON_BILLABLE.some(s => clientLower.includes(s));
                const days = calculateDaysDiff(sale.endDate, todayAnchor);

                if (filterStatus === 'Libres' && !isFree) return false;
                if (filterStatus === 'Ocupados' && (isFree || isProblem)) return false;
                if (filterStatus === 'Problemas' && (!isProblem || isFree)) return false; // Libre no es problema
                if (filterStatus === 'Vencidos') {
                    // Solo vencidos reales (clientes activos con fecha pasada)
                    if (isFree || isProblem || !sale.endDate) return false;
                    if (days >= 0) return false; 
                }
            }
            
            // D. FILTRO FECHA (Comparación de Strings ISO YYYY-MM-DD es segura y rápida)
            if (hasDateFilter) {
                if (!sale.endDate) return false;
                if (dateFrom && sale.endDate < dateFrom) return false;
                if (dateTo && sale.endDate > dateTo) return false;
            }

            return true;
        });
    }, [sales, filterClient, filterService, filterStatus, dateFrom, dateTo, todayAnchor]);

    // ========================================================================
    // 3. ANALYTICS & INVENTORY
    // ========================================================================
    
    // Total Dinero (Excluyendo basura)
    const totalFilteredMoney = useMemo(() => filteredSales.reduce((sum, s) => {
        const clientLower = (s.client || '').toLowerCase();
        // Chequeo rápido contra lista negra
        if (NON_BILLABLE.some(st => clientLower.includes(st))) return sum;
        return sum + (Number(s.cost) || 0);
    }, 0), [filteredSales]);

    // Inventario Agrupado (Bóveda de Credenciales)
    const accountsInventory = useMemo(() => {
        const groups = {};
        sales.forEach(s => {
            // Agrupamos por: Email + Pass + Plataforma Base (ej: Netflix)
            // Esto agrupa "Netflix Pantalla" y "Netflix Completa" en el mismo bucket
            const platformName = getPlatformBaseName(s.service);
            const key = `${s.email}|${s.pass}|${platformName}`;
            
            if (!groups[key]) {
                groups[key] = { 
                    id: s.id, // ID de referencia (cualquiera del grupo)
                    email: s.email, 
                    pass: s.pass, 
                    service: platformName, 
                    total: 0, 
                    free: 0,
                    ids: [] 
                };
            }
            
            groups[key].total++;
            if ((s.client || '').toLowerCase().includes('libre')) groups[key].free++;
            groups[key].ids.push(s.id);
        });
        
        // Convertimos a array y ordenamos: Primero los que tienen libres, luego por nombre
        return Object.values(groups).sort((a, b) => {
            if (b.free !== a.free) return b.free - a.free;
            return a.service.localeCompare(b.service);
        });
    }, [sales]);

    // Sugerencia de Perfiles previos (Para autocompletar)
    const getClientPreviousProfiles = useMemo(() => {
        if (!currentFormData.client || currentFormData.client === 'LIBRE') return [];
        return sales
            .filter(s => s.client === currentFormData.client && s.profile)
            .map(s => ({ profile: s.profile, pin: s.pin }))
            // Eliminar duplicados exactos
            .filter((v, i, a) => a.findIndex(t => t.profile === v.profile) === i);
    }, [sales, currentFormData.client]);

    // Slots disponibles para la venta actual
    const maxAvailableSlots = useMemo(() => {
        if (!currentFormData.service || !currentFormData.email) return 5;
        // Búsqueda estricta para evitar vender un perfil de Disney en una cuenta de Netflix
        return sales.filter(s => 
            s.email === currentFormData.email && 
            s.service === currentFormData.service && 
            (s.client || '').toLowerCase().includes('libre')
        ).length;
    }, [sales, currentFormData.service, currentFormData.email]);

    // ========================================================================
    // 4. ALERTAS & VISUALS
    // ========================================================================

    const isBillable = useCallback((s) => {
        const c = (s.client || '').toLowerCase();
        if (c.includes('libre') || !s.endDate) return false;
        if (NON_BILLABLE.some(status => c.includes(status))) return false;
        return true;
    }, []);

    // Memoizamos listas de alertas para el Dashboard
    const { expiringToday, expiringTomorrow, overdueSales } = useMemo(() => {
        const today = [];
        const tomorrow = [];
        const overdue = [];

        sales.forEach(s => {
            if (!isBillable(s)) return;
            const days = calculateDaysDiff(s.endDate, todayAnchor);

            if (days < 0) overdue.push(s);
            else if (days === 0) today.push(s);
            else if (days === 1) tomorrow.push(s);
        });

        return { expiringToday: today, expiringTomorrow: tomorrow, overdueSales: overdue };
    }, [sales, todayAnchor, isBillable]);

    // Helpers Visuales (Ahora estables con useCallback)
    const getStatusIcon = useCallback((serviceName) => {
        const lower = serviceName ? serviceName.toLowerCase() : '';
        if (lower.includes('netflix')) return 'N';
        if (lower.includes('disney')) return 'D';
        if (lower.includes('max') || lower.includes('hbo')) return 'M';
        if (lower.includes('prime') || lower.includes('amazon')) return 'P';
        if (lower.includes('paramount')) return 'P+';
        if (lower.includes('apple')) return 'Ap';
        if (lower.includes('youtube')) return 'Y';
        if (lower.includes('spotify')) return 'S';
        if (lower.includes('iptv')) return 'TV';
        return 'S';
    }, []);

    const getStatusColor = useCallback((endDate, client) => {
        const c = (client || '').toLowerCase();
        if (c.includes('libre')) return 'bg-emerald-100 text-emerald-600 border border-emerald-200';
        
        // Estados de error/mantenimiento
        if (NON_BILLABLE.some(s => c.includes(s))) return 'bg-gray-100 text-gray-500 border border-gray-200';
        
        if (!endDate) return 'bg-slate-100 text-slate-500'; 
        
        const days = calculateDaysDiff(endDate, todayAnchor);
        if (days < 0) return 'bg-rose-100 text-rose-600 border border-rose-200'; 
        if (days <= 3) return 'bg-amber-100 text-amber-600 border border-amber-200'; 
        return 'bg-blue-50 text-blue-600 border border-blue-200'; 
    }, [todayAnchor]);

    return {
        filteredSales, 
        totalFilteredMoney, 
        totalItems: filteredSales.length, 
        getClientPreviousProfiles, 
        maxAvailableSlots,
        accountsInventory, 
        packageCatalog: useMemo(() => catalog ? catalog.filter(s => s.type === 'Paquete') : [], [catalog]),
        getStatusIcon, 
        getStatusColor,
        getDaysRemaining, 
        expiringToday, 
        expiringTomorrow, 
        overdueSales
    };
};