// src/components/ConfirmModal.jsx
import React from 'react';
import { AlertTriangle, Trash2, RotateCcw, X, ShieldAlert } from 'lucide-react';

const ConfirmModal = ({ modal, onClose, onConfirm, darkMode }) => {
    if (!modal.show) return null;

    // Colores dinámicos del Modal
    const theme = {
        bg: darkMode ? 'bg-[#161B28]' : 'bg-white',
        text: darkMode ? 'text-white' : 'text-slate-800',
        subtext: darkMode ? 'text-slate-400' : 'text-slate-500',
        cancelBtn: darkMode ? 'bg-white/5 text-slate-300 hover:bg-white/10 border-white/5' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
    };

    // Configuración según tipo de alerta
    const config = {
        delete_service: { icon: Trash2, color: 'text-rose-500', bg: darkMode ? 'bg-rose-500/10' : 'bg-rose-100', btn: 'bg-rose-600 hover:bg-rose-700' },
        delete_account: { icon: Trash2, color: 'text-rose-500', bg: darkMode ? 'bg-rose-500/10' : 'bg-rose-100', btn: 'bg-rose-600 hover:bg-rose-700' },
        delete_free_stock: { icon: ShieldAlert, color: 'text-amber-500', bg: darkMode ? 'bg-amber-500/10' : 'bg-amber-100', btn: 'bg-amber-600 hover:bg-amber-700' },
        liberate: { icon: RotateCcw, color: 'text-orange-500', bg: darkMode ? 'bg-orange-500/10' : 'bg-orange-100', btn: 'bg-orange-500 hover:bg-orange-600' },
    };

    const typeConfig = config[modal.type] || config['delete_service'];
    const Icon = typeConfig.icon;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className={`w-full max-w-sm rounded-[2rem] shadow-2xl p-6 text-center animate-in zoom-in-95 duration-300 ${theme.bg}`}>
                
                {/* Icono Grande */}
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${typeConfig.bg} ${typeConfig.color}`}>
                    <Icon size={40} strokeWidth={2.5}/>
                </div>

                {/* Textos */}
                <h3 className={`text-2xl font-black mb-2 tracking-tight ${theme.text}`}>
                    {modal.title}
                </h3>
                <p className={`text-sm font-medium mb-8 leading-relaxed px-4 ${theme.subtext}`}>
                    {modal.msg}
                </p>

                {/* Botones */}
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={onConfirm}
                        className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-all ${typeConfig.btn}`}
                    >
                        Confirmar Acción
                    </button>
                    <button 
                        onClick={onClose}
                        className={`w-full py-3.5 rounded-xl font-bold border active:scale-95 transition-all ${theme.cancelBtn}`}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;