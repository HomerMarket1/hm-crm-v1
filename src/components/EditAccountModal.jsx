// src/components/EditAccountModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Lock, KeyRound, Mail } from 'lucide-react';

const EditAccountModal = ({ modal, setModal, onConfirm }) => {
    // 🚀 ESTADO LOCAL: Esto es el secreto de la velocidad.
    // Al usar esto, escribir no recarga toda la app, solo este cuadrito.
    const [localPass, setLocalPass] = useState('');

    // Sincronizar al abrir
    useEffect(() => {
        if (modal.show) {
            setLocalPass(''); // Empieza vacío o podrías poner modal.newPass si quisieras editar
        }
    }, [modal.show]);

    const handleSave = () => {
        // Al guardar, enviamos la contraseña local directamente a la función de App
        onConfirm(localPass);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-800 transform transition-all scale-100">
                
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight">Editar Contraseña de Cuenta</h2>
                        <div className="flex items-center gap-2 mt-1 text-slate-400 text-xs font-medium">
                            <Mail size={12} />
                            <span>Cuenta: {modal.email}</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => setModal({ ...modal, show: false })}
                        className="p-2 bg-slate-800 text-slate-400 rounded-full hover:bg-slate-700 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nueva Contraseña</label>
                        <div className="relative group">
                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                            <input 
                                type="text" 
                                autoFocus
                                value={localPass}
                                onChange={(e) => setLocalPass(e.target.value)} // ✅ Solo actualiza aquí, súper rápido
                                className="w-full bg-slate-800 border border-slate-700 text-white font-bold rounded-xl py-3 pl-11 pr-4 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                                placeholder="Escribe la nueva clave..."
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 mt-8 pt-4 border-t border-slate-800">
                    <button 
                        onClick={() => setModal({ ...modal, show: false })}
                        className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 active:scale-95 transition-all"
                    >
                        Guardar Cambios
                    </button>
                </div>

            </div>
        </div>
    );
};

export default EditAccountModal;