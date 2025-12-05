// src/hooks/useSalesData.js

import { useMemo } from 'react';
import { getDaysRemaining } from '../utils/helpers';

// Lista de estados que no deben sumar a las ganancias totales
const NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED'];

export const useSalesData = (sales, catalog, clientsDirectory, uiState, formData) => {
    
    // Desestructurar los filtros del estado de UI
    const { 
        filterClient, filterService, filterStatus, dateFrom, dateTo 
    } = uiState;

    // =========================================================================
    // 1. LÓGICA DE FILTRADO (La parte más importante que movemos de App.jsx)
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
                matchDate = false; // Excluir ventas sin fecha si se aplica un filtro de fecha
            }
            
            return matchSearch && matchService && matchStatus && matchDate;
        });
    }, [sales, filterClient, filterService, filterStatus, dateFrom, dateTo]);


    // =========================================================================
    // 2. CÁLCULOS DERIVADOS (Que también se mueven de App.jsx)
    // =========================================================================

    const totalFilteredMoney = useMemo(() => {
        return filteredSales.reduce((acc, curr) => {
            const isExcluded = curr.client === 'LIBRE' || NON_BILLABLE_STATUSES.includes(curr.client) || curr.client === 'Admin';
            return !isExcluded ? acc + (Number(curr.cost) || 0) : acc;
        }, 0);
    }, [filteredSales]);
    
    const totalItems = filteredSales.length;

    // =========================================================================
    // 3. DATOS SECUNDARIOS (Otros useMemo que estaban en App.jsx)
    // =========================================================================
    
    const allClients = useMemo(() => {
        const fromDir = clientsDirectory.map(c => ({ name: c.name, phone: c.phone }));
        const fromSales = sales
            .filter(s => s.client && s.client !== 'LIBRE' && !NON_BILLABLE_STATUSES.includes(s.client))
            .map(s => ({ name: s.client, phone: s.phone }));
        
        const combined = [...fromDir, ...fromSales];
        const unique = [];
        const map = new Map();
        for (const item of combined) {
            if (!item.name) continue;
            const key = item.name.toLowerCase().trim();
            if(!map.has(key)) { map.set(key, true); unique.push(item); }
        }
        return unique.sort((a, b) => a.name.localeCompare(b.name));
    }, [sales, clientsDirectory]);
    
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
            if (sale.client === 'LIBRE') groups[sale.email].free++;
            groups[sale.email].ids.push(sale.id);
        });
        return Object.values(groups);
    }, [sales]);

    const packageCatalog = useMemo(() => {
        return catalog.filter(s => s.type === 'Paquete' || s.name.toLowerCase().includes('paquete'));
    }, [catalog]);

    // =========================================================================
    // 4. FUNCIONES DE UTILITY (Mantener aquí las funciones que dependen de props)
    // =========================================================================

    const getStatusIcon = (clientName) => {
        // ... (Iconos iguales)
        if (clientName === 'LIBRE') return '✅';
        if (clientName === 'Caída') return '⚠️';
        if (clientName === 'Actualizar') return '🔄';
        if (clientName === 'Dominio') return '🌐';
        if (clientName === 'Admin') return '🛡️';
        if (clientName === 'EXPIRED') return '💀';
        return clientName.charAt(0);
    };
    
    const getStatusColor = (clientName) => {
        // ... (Colores iguales)
        if (clientName === 'LIBRE') return 'bg-emerald-100 text-emerald-600';
        if (clientName === 'Caída') return 'bg-red-100 text-red-600';
        if (clientName === 'Actualizar') return 'bg-blue-100 text-blue-600';
        if (clientName === 'Dominio') return 'bg-violet-100 text-violet-600';
        if (clientName === 'Admin') return 'bg-slate-800 text-white';
        if (clientName === 'EXPIRED') return 'bg-slate-200 text-slate-500';
        return 'bg-[#007AFF] text-white'; 
    };

    return {
        // Datos filtrados
        filteredSales,
        totalFilteredMoney,
        totalItems,
        NON_BILLABLE_STATUSES, // <-- Exportar la constante

        // Datos secundarios y utilidades
        allClients,
        getClientPreviousProfiles,
        maxAvailableSlots,
        accountsInventory,
        packageCatalog,

        // Funciones de utilidad (solo si se usan en la vista sin depender de más props)
        getStatusIcon,
        getStatusColor,
        getDaysRemaining, // <-- Importada desde utils/helpers
    };
};