import React, { useState } from 'react'; // Importar useState
import { Plus, Trash2, Search } from 'lucide-react'; // Importar Search icon

// Clase unificada para Inputs y Selects
const INPUT_CLASS = "w-full p-3 bg-slate-100/70 border border-slate-200/50 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white";
const BUTTON_SEGMENT_CLASS = (isActive) => 
    `flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.98] ${
        isActive 
            ? 'bg-white text-slate-900 shadow-sm' 
            : 'text-slate-500 hover:bg-slate-200/70'
    }`;


const StockManager = ({
    accountsInventory,
    stockTab, // Valor actual (viene de uiState.stockTab)
    setStockTab, // Función para cambiar el estado (viene del dispatch)
    stockForm, setStockForm,
    catalog,
    handleStockServiceChange,
    handleGenerateStock,
    triggerDeleteAccount
}) => {
    // 1. ESTADO PARA LA BARRA DE BÚSQUEDA
    const [searchInventory, setSearchInventory] = useState('');

    // 2. LÓGICA DE FILTRADO DINÁMICO
    const filteredAccounts = accountsInventory.filter(acc => 
        // Filtra por email o por el nombre del servicio
        acc.email.toLowerCase().includes(searchInventory.toLowerCase()) ||
        acc.service.toLowerCase().includes(searchInventory.toLowerCase())
    );

    return (
        <div className="space-y-6 w-full pb-20">
            
            {/* 1. PESTAÑAS DE NAVEGACIÓN (Control Segmentado) */}
            <div className="flex gap-2 p-1 bg-slate-100/50 rounded-xl border border-slate-200/50 shadow-inner">
                {/* Se usa setStockTab(valor) directamente */}
                <button onClick={() => setStockTab('add')} className={BUTTON_SEGMENT_CLASS(stockTab === 'add')}>➕ Agregar Stock</button>
                <button onClick={() => setStockTab('manage')} className={BUTTON_SEGMENT_CLASS(stockTab === 'manage')}>📋 Gestionar Cuentas</button>
            </div>

            {stockTab === 'add' ? (
                // FORMULARIO AGREGAR (Tarjeta limpia e Inputs unificados)
                <div className="w-full bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/50">
                    <h2 className="text-xl font-black text-slate-800 mb-6">Agregar Stock</h2>
                    <form onSubmit={handleGenerateStock} className="space-y-4">
                        
                        <select className={INPUT_CLASS} value={stockForm.service} onChange={handleStockServiceChange}>
                            <option value="">Seleccionar Servicio...</option>
                            {catalog.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                        
                        <input className={INPUT_CLASS} value={stockForm.email} onChange={e=>setStockForm({...stockForm, email:e.target.value})} placeholder="Correo"/>
                        
                        <input className={INPUT_CLASS} value={stockForm.pass} onChange={e=>setStockForm({...stockForm, pass:e.target.value})} placeholder="Contraseña"/>
                        
                        <div className="flex items-center gap-3">
                            {/* Input de slots con diseño de cápsula */}
                            <input 
                                type="number" 
                                className="w-16 p-3 bg-blue-50 text-blue-600 font-bold rounded-xl text-center outline-none border-blue-100 border focus:bg-white focus:ring-1 focus:ring-blue-300 transition-colors" 
                                value={stockForm.slots} 
                                onChange={e=>setStockForm({...stockForm, slots:Number(e.target.value)})}
                            />
                            <span className="text-xs font-bold text-slate-400">Cupos</span>
                        </div>
                        
                        <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:opacity-90 active:scale-95 transition-opacity">Generar Stock</button>
                    </form>
                </div>
            ) : (
                // GESTOR DE CUENTAS (Borrado Masivo - Tarjetas limpias)
                <div className="space-y-3">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase">Cuentas Registradas ({filteredAccounts.length} de {accountsInventory.length})</h3>
                    </div>

                    {/* BARRA DE BÚSQUEDA INTEGRADA */}
                    <div className="relative mb-4">
                        <input
                            type="text"
                            placeholder="Buscar por correo o servicio..."
                            value={searchInventory}
                            onChange={(e) => setSearchInventory(e.target.value)}
                            className="w-full p-3 pl-10 bg-white border border-slate-200/50 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent shadow-sm"
                        />
                        <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    </div>
                    {/* FIN BARRA DE BÚSQUEDA */}


                    {filteredAccounts.length === 0 && <p className="text-center text-slate-400 text-xs py-8 bg-white rounded-xl border border-slate-100/50">
                        {searchInventory.length > 0 ? `No se encontraron cuentas para "${searchInventory}".` : 'No hay cuentas madre registradas.'}
                    </p>}
                    
                    {filteredAccounts.map((acc, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-white/50 shadow-md transition-shadow hover:shadow-lg">
                            <div className="overflow-hidden">
                                <div className="font-bold text-slate-800 text-sm truncate">{acc.service}</div>
                                <div className="text-xs text-slate-500 truncate">{acc.email}</div>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Libres: {acc.free}</span>
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Total: {acc.total}</span>
                                </div>
                            </div>
                            {/* BOTÓN DE PAPELERA UNIFICADO (Light button, Red icon) */}
                            <button 
                                onClick={() => triggerDeleteAccount(acc)} 
                                className="p-2 w-10 h-10 bg-red-50 text-red-500 border border-red-100 rounded-lg shadow-sm hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StockManager;