// src/reducers/uiReducer.js (VERSIÓN PULIDA)

// Vistas del menú enlazables por URL (/, /boveda, /ajustes): permite Ctrl+clic / abrir en pestaña nueva
export const VIEW_PATHS = { dashboard: '/', inventory: '/boveda', config: '/ajustes' };
export const viewFromPath = (path = window.location.pathname) => {
    const p = path.replace(/\/+$/, '') || '/';
    return Object.keys(VIEW_PATHS).find(v => VIEW_PATHS[v] === p) || 'dashboard';
};

// Estado inicial: Contiene todos los useState de UI que estaban en App.jsx
export const initialUiState = {
    view: viewFromPath(),
    stockTab: 'add',
    filterClient: '',
    filterService: 'Todos',
    filterStatus: 'Todos',
    dateFrom: '',
    dateTo: '',
};

// Acciones para modificar el estado
export const uiActionTypes = {
    SET_VIEW: 'SET_VIEW',
    SET_STOCK_TAB: 'SET_STOCK_TAB',
    SET_FILTER: 'SET_FILTER',
    RESET_FILTERS: 'RESET_FILTERS',
};

// La función reducer: define cómo el estado cambia en respuesta a una acción
export const uiReducer = (state, action) => {
    switch (action.type) {
        case uiActionTypes.SET_VIEW:
            return {
                ...state,
                view: action.payload,
            };

        case uiActionTypes.SET_STOCK_TAB:
            return {
                ...state,
                stockTab: action.payload,
            };

        case uiActionTypes.SET_FILTER:
            return {
                ...state,
                // El payload debe ser un objeto: { key: 'nombre_del_filtro', value: 'nuevo_valor' }
                [action.payload.key]: action.payload.value,
            };
            
        case uiActionTypes.RESET_FILTERS:
            // 💡 PULIDO: Mantenemos la vista y aplicamos solo los valores iniciales de los filtros.
            return {
                ...initialUiState,
                // Sobrescribimos 'view' y cualquier propiedad que NO deba resetearse
                view: state.view, 
            };

        default:
            return state;
    }
};