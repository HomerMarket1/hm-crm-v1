// src/hooks/useSalesData.js (VERSIÓN FUSIÓN: LÓGICA ANTIGUA + ESTRUCTURA NUEVA)
import { useMemo } from 'react';

// --- TUS ESTADOS PERSONALIZADOS ---
const NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED', 'Vencido', 'Cancelado'];
const NON_ALERT_STATUSES = ['LIBRE', 'Admin', ...NON_BILLABLE_STATUSES];

export const useSalesData = (sales, catalog, allClients, uiState, formData) => { 
    
    // Desestructurar los filtros del estado de UI
    const { filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;

    // =========================================================================
    // 0. HELPERS INTERNOS (Para evitar errores de importación)
    // =========================================================================
    
    const getDaysRemaining = (dateString) => {
        if (!dateString) return 0;
        const today = new Date();
        const end = new Date(dateString);
        const diffTime = end - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const getStatusIcon = (serviceName) => {
        const lower = serviceName ? serviceName.toLowerCase() : '';
        return lower.includes('netflix') ? 'N' : lower.includes('disney') ? 'D' : 'S';
    };

    const getStatusColor = (endDate, client) => {
        if (client === 'LIBRE') return 'bg-emerald-100 text-emerald-600 border-emerald-200';
        if (NON_BILLABLE_STATUSES.includes(client)) return 'bg-gray-100 text-gray-500 border-gray-200';
        if (!endDate) return 'bg-slate-100 text-slate-500';
        
        const days = getDaysRemaining(endDate);
        if (days < 0) return 'bg-rose-100 text-rose-600 border-rose-200'; // Vencido
        if (days <= 3) return 'bg-amber-100 text-amber-600 border-amber-200'; // Por vencer
        return 'bg-blue-50 text-blue-600 border-blue-200'; // Activo
    };

    // =========================================================================
    // 1. LÓGICA DE FILTRADO (TU LÓGICA ORIGINAL RESTAURADA ✅)
    // =========================================================================

    const filteredSales = useMemo(() => {
        if (!sales) return []; // Protección contra nulos

        return sales.filter(s => {
            const isFree = s.client === 'LIBRE';
            const isProblem = NON_BILLABLE_STATUSES.includes(s.client);
            
            // Filtro por Cliente/Email
            const matchSearch = !filterClient || 
                                s.client.toLowerCase().includes(filterClient.toLowerCase()) ||
                                (s.email && s.email.toLowerCase().includes(filterClient.toLowerCase())); 
            
            // Filtro por Servicio
            const matchService = !filterService || filterService === 'Todos' || s.service === filterService;
            
            // Filtro por Estado (Tus reglas exactas)
            let matchStatus = true;
            if (filterStatus === 'Libres') matchStatus = isFree;
            if (filterStatus === 'Ocupados') matchStatus = !isFree && !isProblem;
            if (filterStatus === 'Problemas') matchStatus = isProblem;
            // Agregamos soporte para 'Vencidos' y 'Activos' por si la UI nueva lo pide
            if (filterStatus === 'Vencidos') {
                const days = getDaysRemaining(s.endDate);
                matchStatus = days < 0 && !isFree;
            }
            if (filterStatus === 'Activos') {
                const days = getDaysRemaining(s.endDate);
                matchStatus = days >= 0 && !isFree && !isProblem;
            }
            
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
            } else if ((dateFrom || dateTo) && !s.endDate) {
                matchDate = false; 
            }
            
            return matchSearch && matchService && matchStatus && matchDate;
        });
    }, [sales, filterClient, filterService, filterStatus, dateFrom, dateTo]);

    // =========================================================================
    // 2. CÁLCULO DE ALERTAS DE VENCIMIENTO
    // =========================================================================
    
    const { expiringToday, expiringTomorrow, overdueSales } = useMemo(() => {
        const today = [];
        const tomorrow = [];
        const overdue = [];

        if (sales) {
            sales.forEach(sale => {
                // Usamos tu lista de exclusión NON_ALERT_STATUSES
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
    // 3. CÁLCULOS DERIVADOS (Dinero, Items, etc.)
    // =========================================================================

    const totalFilteredMoney = useMemo(() => {
        return filteredSales.reduce((acc, curr) => {
            const isExcluded = curr.client === 'LIBRE' || NON_BILLABLE_STATUSES.includes(curr.client) || curr.client === 'Admin';
            return !isExcluded ? acc + (Number(curr.cost) || 0) : acc;
        }, 0);
    }, [filteredSales]);
    
    const totalItems = filteredSales.length;

    // =========================================================================
    // 4. BÓVEDA DE INVENTARIO (CRÍTICO PARA STOCK MANAGER) 🛡️
    // =========================================================================
    
    const accountsInventory = useMemo(() => {
        const groups = {};
        
        if (!sales) return [];

        sales.forEach(sale => {
            if (!sale.email) return;

            // Clave única: Email + Servicio (Para evitar mezclar cuentas de Disney con Netflix si usan el mismo correo)
            // Si prefieres agrupar SOLO por email como en tu código viejo, cambia esto a: const key = sale.email;
            const key = `${sale.email}-${sale.service}`; 
            
            if (!groups[key]) {
                groups[key] = {
                    id: key, // Necesario para React keys
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
            
            // Tu lógica corregida para contar libres
            if (sale.client === 'LIBRE') {
                groups[key].free++;
            }
        });
        
        return Object.values(groups);
    }, [sales]);

    // =========================================================================
    // 5. UTILIDADES EXTRAS (Paquetes, Historial Cliente)
    // =========================================================================

    const getClientPreviousProfiles = useMemo(() => {
        if (!formData.client || formData.client === 'LIBRE') return [];
        const clientName = formData.client.toLowerCase();
        // Lógica segura para evitar errores si s.client es null
        const history = sales.filter(s => s.client && s.client.toLowerCase() === clientName && s.profile)
                             .map(s => ({ profile: s.profile, pin: s.pin }));
        
        // Eliminar duplicados
        const unique = [];
        const map = new Map();
        for (const item of history) { 
            if(!map.has(item.profile)) { 
                map.set(item.profile, true); 
                unique.push(item); 
            } 
        }
        return unique;
    }, [sales, formData.client]);

    const maxAvailableSlots = useMemo(() => {
        if (formData.client !== 'LIBRE' && formData.id) return 1;
        // Calcula cuántos perfiles libres quedan para este email en específico
        return sales.filter(s => s.email === formData.email && s.client === 'LIBRE').length;
    }, [sales, formData.email, formData.id]);
    
    const packageCatalog = useMemo(() => {
        if (!catalog) return [];
        return catalog.filter(s => s.type === 'Paquete' || (s.name && s.name.toLowerCase().includes('paquete')));
    }, [catalog]);


    // =========================================================================
    // 6. EXPORTACIÓN FINAL (Compatible con App.jsx)
    // =========================================================================

    return {
        // Datos principales
        filteredSales,
        totalFilteredMoney,
        totalItems,
        
        // Inventario y Catálogo
        accountsInventory, // ¡Esto ahora sí se llenará!
        packageCatalog,
        maxAvailableSlots,
        
        // Alertas
        expiringToday,
        expiringTomorrow,
        overdueSales,

        // Clientes y Listas
        allClients,
        getClientPreviousProfiles,

        // Constantes y Helpers
        NON_BILLABLE_STATUSES, 
        getStatusIcon, 
        getStatusColor,
        getDaysRemaining, 
    };
};