// src/reducers/uiReducer.js

// Estado inicial: Contiene todos los useState de UI que estaban en App.jsx
export const initialUiState = {
    view: 'dashboard',
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
                // El payload debe ser un objeto: { key: 'filterClient', value: 'nuevo_valor' }
                [action.payload.key]: action.payload.value,
            };
            
        case uiActionTypes.RESET_FILTERS:
            // Conserva la vista actual, pero restablece los filtros y pestañas
            return {
                ...state,
                stockTab: initialUiState.stockTab,
                filterClient: initialUiState.filterClient,
                filterService: initialUiState.filterService,
                filterStatus: initialUiState.filterStatus,
                dateFrom: initialUiState.dateFrom,
                dateTo: initialUiState.dateTo,
            };

        default:
            return state;
    }
};