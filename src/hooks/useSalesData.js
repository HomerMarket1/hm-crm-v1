import { useMemo } from 'react';
// Importamos las utilidades de fecha y UI desde helpers.js
import { getDaysRemaining, getStatusIcon, getStatusColor } from '../utils/helpers'; 

// Lista de estados que no deben sumar a las ganancias totales
const NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED'];

export const useSalesData = (sales, catalog, allClients, uiState, formData) => { 
    
    // Desestructurar los filtros del estado de UI
    const { 
        filterClient, filterService, filterStatus, dateFrom, dateTo 
    } = uiState;

    // =========================================================================
    // 1. LÓGICA DE FILTRADO
    // =========================================================================

    const filteredSales = useMemo(() => {
        return sales.filter(s => {
            const isFree = s.client === 'LIBRE';
            const isProblem = NON_BILLABLE_STATUSES.includes(s.client);
            
            // Filtro por Cliente/Email
            const matchSearch = filterClient === '' || 
                                s.client.toLowerCase().includes(filterClient.toLowerCase()) ||
                                s.email.toLowerCase().includes(filterClient.toLowerCase()); 
            
            // Filtro por Servicio
            const matchService = filterService === 'Todos' || s.service === filterService;
            
            // Filtro por Estado (Libres, Ocupados, Problemas)
            let matchStatus = true;
            if (filterStatus === 'Libres') matchStatus = isFree;
            if (filterStatus === 'Ocupados') matchStatus = !isFree && !isProblem;
            if (filterStatus === 'Problemas') matchStatus = isProblem;
            
            // Filtro por Fechas
            let matchDate = true;
            if (s.endDate) {
                const endDate = new Date(s.endDate);
                endDate.setHours(0, 0, 0, 0);

                if (dateFrom && dateTo) {
                    const dateF = new Date(dateFrom); dateF.setHours(0, 0, 0, 0);
                    const dateT = new Date(dateTo); dateT.setHours(0, 0, 0, 0);
                    matchDate = endDate >= dateF && endDate <= dateT;
                } else if (dateFrom) {
                    const dateF = new Date(dateFrom); dateF.setHours(0, 0, 0, 0);
                    matchDate = endDate.getTime() === dateF.getTime(); 
                }
            } else if (dateFrom || dateTo) {
                matchDate = false; 
            }
            
            return matchSearch && matchService && matchStatus && matchDate;
        });
    }, [sales, filterClient, filterService, filterStatus, dateFrom, dateTo]);

    // =========================================================================
    // 2. CÁLCULO DE ALERTAS DE VENCIMIENTO
    // =========================================================================
    
    const NON_ALERT_STATUSES = ['LIBRE', 'Admin', ...NON_BILLABLE_STATUSES];

    const validSales = useMemo(() => {
        return sales.filter(s => 
            s.client && 
            !NON_ALERT_STATUSES.includes(s.client)
        );
    }, [sales, NON_BILLABLE_STATUSES]); 

    const expiringAlerts = useMemo(() => {
        const today = [];
        const tomorrow = [];
        const overdue = [];

        validSales.forEach(sale => {
            const days = getDaysRemaining(sale.endDate); 
            
            if (days === 0) {
                today.push(sale);
            } else if (days === 1) {
                tomorrow.push(sale);
            } else if (days < 0) {
                overdue.push(sale);
            }
        });

        return { 
            expiringToday: today, 
            expiringTomorrow: tomorrow, 
            overdueSales: overdue 
        };
    }, [validSales, getDaysRemaining]);
    
    const { expiringToday, expiringTomorrow, overdueSales } = expiringAlerts;


    // =========================================================================
    // 3. CÁLCULOS DERIVADOS
    // =========================================================================

    const totalFilteredMoney = useMemo(() => {
        return filteredSales.reduce((acc, curr) => {
            const isExcluded = curr.client === 'LIBRE' || NON_BILLABLE_STATUSES.includes(curr.client) || curr.client === 'Admin';
            return !isExcluded ? acc + (Number(curr.cost) || 0) : acc;
        }, 0);
    }, [filteredSales]);
    
    const totalItems = filteredSales.length;

    // =========================================================================
    // 4. DATOS SECUNDARIOS
    // =========================================================================
    
    const getClientPreviousProfiles = useMemo(() => {
        if (!formData.client || formData.client === 'LIBRE') return [];
        const clientName = formData.client.toLowerCase();
        const history = sales.filter(s => s.client && s.client.toLowerCase() === clientName && s.profile).map(s => ({ profile: s.profile, pin: s.pin }));
        const unique = [];
        const map = new Map();
        for (const item of history) { if(!map.has(item.profile)) { map.set(item.profile, true); unique.push(item); } }
        return unique;
    }, [sales, formData.client]);

    const maxAvailableSlots = useMemo(() => {
        if (formData.client !== 'LIBRE' && formData.id) return 1;
        return sales.filter(s => s.email === formData.email && s.client === 'LIBRE').length;
    }, [sales, formData.email, formData.id]);
    
    const accountsInventory = useMemo(() => {
        const groups = {};
        sales.forEach(sale => {
            if (!sale.email) return;
            if (!groups[sale.email]) {
                groups[sale.email] = {
                    email: sale.email,
                    service: sale.service,
                    pass: sale.pass,
                    total: 0,
                    free: 0,
                    ids: []
                };
            }
            groups[sale.email].total++;
            // ✅ CORRECCIÓN DE TYPO: groups[sale.email].free++ en lugar de groups[f.email].free++
            if (sale.client === 'LIBRE') groups[sale.email].free++;
            groups[sale.email].ids.push(sale.id);
        });
        return Object.values(groups);
    }, [sales]);

    const packageCatalog = useMemo(() => {
        return catalog.filter(s => s.type === 'Paquete' || s.name.toLowerCase().includes('paquete'));
    }, [catalog]);

    // =========================================================================
    // 5. EXPORTACIÓN
    // =========================================================================

    return {
        // Datos filtrados
        filteredSales,
        totalFilteredMoney,
        totalItems,
        NON_BILLABLE_STATUSES, 

        // Datos de Alertas
        expiringToday,
        expiringTomorrow,
        overdueSales,

        // Datos secundarios y utilidades
        allClients,
        getClientPreviousProfiles,
        maxAvailableSlots,
        accountsInventory,
        packageCatalog,

        // Funciones de utilidad (importadas de helpers)
        getStatusIcon, 
        getStatusColor,
        getDaysRemaining, 
    };
};