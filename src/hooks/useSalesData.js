import { useMemo } from 'react';

// =========================================================================
// CONSTANTES INTERNAS (Para que no dependas de archivos externos)
// =========================================================================
const NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED', 'Vencido', 'Cancelado'];
const NON_ALERT_STATUSES = ['LIBRE', 'Admin', ...NON_BILLABLE_STATUSES];

// =========================================================================
// 0. HELPERS ESTATICOS (Optimizados fuera del Hook)
// =========================================================================

const getDaysRemaining = (dateString) => {
    if (!dateString) return 0;
    const today = new Date();
    today.setHours(0,0,0,0); // Normalizar hoy
    const end = new Date(dateString);
    end.setHours(0,0,0,0) + 12; // Ajuste zona horaria seguro
    const diffTime = end - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getStatusIcon = (serviceName) => {
    const lower = serviceName ? serviceName.toLowerCase() : '';
    return lower.includes('netflix') ? 'N' : lower.includes('disney') ? 'D' : 'S';
};

const getStatusColor = (client, endDate) => {
    if (client === 'LIBRE') return 'bg-emerald-100 text-emerald-600 border-emerald-200';
    if (NON_BILLABLE_STATUSES.includes(client)) return 'bg-gray-100 text-gray-500 border-gray-200';
    if (!endDate) return 'bg-slate-100 text-slate-500';
    
    const days = getDaysRemaining(endDate);
    if (days < 0) return 'bg-rose-100 text-rose-600 border-rose-200'; // Vencido
    if (days <= 3) return 'bg-amber-100 text-amber-600 border-amber-200'; // Por vencer
    return 'bg-blue-50 text-blue-600 border-blue-200'; // Activo
};

// =========================================================================
// HOOK PRINCIPAL
// =========================================================================

export const useSalesData = (sales, catalog, allClients, uiState, formData) => { 
    
    const { filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;

    // =========================================================================
    // 1. LÓGICA DE FILTRADO (Optimizada)
    // =========================================================================

    const filteredSales = useMemo(() => {
        if (!sales) return []; 

        // Optimización: Calcular minúsculas FUERA del bucle
        const searchLower = filterClient ? filterClient.toLowerCase() : '';
        const hasDateFilter = !!(dateFrom || dateTo);
        
        // Preparar fechas de filtro una sola vez
        let dateF, dateT;
        if (hasDateFilter) {
            if(dateFrom) { dateF = new Date(dateFrom); dateF.setHours(0,0,0,0); }
            if(dateTo) { dateT = new Date(dateTo); dateT.setHours(0,0,0,0); }
        }

        return sales.filter(s => {
            // 1. Filtro Rápido: Estado
            const isFree = s.client === 'LIBRE';
            const isProblem = NON_BILLABLE_STATUSES.includes(s.client);
            
            let matchStatus = true;
            if (filterStatus === 'Libres') matchStatus = isFree;
            else if (filterStatus === 'Ocupados') matchStatus = !isFree && !isProblem;
            else if (filterStatus === 'Problemas') matchStatus = isProblem;
            else if (filterStatus === 'Vencidos') matchStatus = getDaysRemaining(s.endDate) < 0 && !isFree;
            else if (filterStatus === 'Activos') matchStatus = getDaysRemaining(s.endDate) >= 0 && !isFree && !isProblem;
            
            if (!matchStatus) return false;

            // 2. Filtro Texto
            if (searchLower) {
                const clientMatch = s.client.toLowerCase().includes(searchLower);
                const emailMatch = s.email && s.email.toLowerCase().includes(searchLower);
                if (!clientMatch && !emailMatch) return false;
            }
            
            // 3. Filtro Servicio
            if (filterService && filterService !== 'Todos' && s.service !== filterService) return false;
            
            // 4. Filtro Fechas
            if (hasDateFilter) {
                if (!s.endDate) return false;
                const endDate = new Date(s.endDate);
                endDate.setHours(0,0,0,0);
                
                if (dateFrom && dateTo) {
                    if (endDate < dateF || endDate > dateT) return false;
                } else if (dateFrom) {
                    if (endDate.getTime() !== dateF.getTime()) return false;
                }
            }
            
            return true;
        });
    }, [sales, filterClient, filterService, filterStatus, dateFrom, dateTo]);

    // =========================================================================
    // 2. ALERTAS E INVENTARIO
    // =========================================================================
    
    const { expiringToday, expiringTomorrow, overdueSales } = useMemo(() => {
        const today = [];
        const tomorrow = [];
        const overdue = [];

        if (sales) {
            sales.forEach(sale => {
                if (!sale.client || NON_ALERT_STATUSES.includes(sale.client)) return;
                const days = getDaysRemaining(sale.endDate); 
                if (days === 0) today.push(sale);
                else if (days === 1) tomorrow.push(sale);
                else if (days < 0) overdue.push(sale);
            });
        }
        return { expiringToday: today, expiringTomorrow: tomorrow, overdueSales: overdue };
    }, [sales]);

    // =========================================================================
    // 3. CÁLCULOS FINANCIEROS
    // =========================================================================

    const totalFilteredMoney = useMemo(() => {
        return filteredSales.reduce((acc, curr) => {
            const isExcluded = curr.client === 'LIBRE' || NON_BILLABLE_STATUSES.includes(curr.client) || curr.client === 'Admin';
            return !isExcluded ? acc + (Number(curr.cost) || 0) : acc;
        }, 0);
    }, [filteredSales]);
    
    const totalItems = filteredSales.length;

    // =========================================================================
    // 4. BÓVEDA DE INVENTARIO
    // =========================================================================
    
    const accountsInventory = useMemo(() => {
        const groups = {};
        if (!sales) return [];

        sales.forEach(sale => {
            if (!sale.email) return;
            const key = `${sale.email}-${sale.service}`; 
            
            if (!groups[key]) {
                groups[key] = {
                    id: key, 
                    email: sale.email,
                    service: sale.service,
                    pass: sale.pass,
                    total: 0,
                    free: 0,
                    ids: []
                };
            }
            groups[key].total++;
            groups[key].ids.push(sale.id);
            if (sale.client === 'LIBRE') groups[key].free++;
        });
        return Object.values(groups);
    }, [sales]);

    // =========================================================================
    // 5. HELPERS DE FORMULARIO
    // =========================================================================

    const getClientPreviousProfiles = useMemo(() => {
        if (!formData.client || formData.client === 'LIBRE') return [];
        const clientName = formData.client.toLowerCase();
        
        const history = sales.filter(s => s.client && s.client.toLowerCase() === clientName && s.profile)
                             .map(s => ({ profile: s.profile, pin: s.pin }));
        
        const uniqueSet = new Set(history.map(JSON.stringify));
        return Array.from(uniqueSet).map(JSON.parse);
    }, [sales, formData.client]);

    const maxAvailableSlots = useMemo(() => {
        if (formData.client !== 'LIBRE' && formData.id) return 1;
        return sales.filter(s => s.email === formData.email && s.client === 'LIBRE').length;
    }, [sales, formData.email, formData.id]);
    
    const packageCatalog = useMemo(() => {
        if (!catalog) return [];
        return catalog.filter(s => s.type === 'Paquete' || (s.name && s.name.toLowerCase().includes('paquete')));
    }, [catalog]);

    // =========================================================================
    // RETURN
    // =========================================================================

    return {
        filteredSales,
        totalFilteredMoney,
        totalItems,
        accountsInventory,
        packageCatalog,
        maxAvailableSlots,
        expiringToday,
        expiringTomorrow,
        overdueSales,
        allClients,
        getClientPreviousProfiles,
        NON_BILLABLE_STATUSES, 
        getStatusIcon, 
        getStatusColor: (date, client) => getStatusColor(client, date),
        getDaysRemaining, 
    };
};