// src/components/ConfirmModal.jsx
import React from 'react';
import { Trash2, RotateCcw } from 'lucide-react';

const ConfirmModal = ({ modal, onClose, onConfirm }) => {
    if (!modal.show) return null;

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 shadow-2xl max-w-sm w-full border border-white/50 text-center transform scale-100 transition-all">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 mx-auto shadow-inner ${modal.type === 'delete_service' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                    {modal.type === 'delete_service' ? <Trash2 size={32}/> : <RotateCcw size={32}/>}
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">{modal.title}</h3>
                <p className="text-slate-500 mb-8 text-base font-medium leading-relaxed">{modal.msg}</p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={onConfirm} 
                        className={`w-full py-4 text-white rounded-2xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all ${modal.type === 'delete_service' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'}`}
                    >
                        Confirmar Acción
                    </button>
                    <button 
                        onClick={onClose} 
                        className="w-full py-4 bg-white text-slate-500 rounded-2xl font-bold hover:bg-slate-50 active:scale-95 transition-all border border-slate-200"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;