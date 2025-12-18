// src/components/EditClientModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, User, Phone } from 'lucide-react';

const EditClientModal = ({ modal, setModal, onConfirm, darkMode }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    // Cargar datos al abrir
    useEffect(() => {
        if (modal.client) {
            setName(modal.client.name || '');
            setPhone(modal.client.phone || '');
        }
    }, [modal.client]);

    const handleSave = () => {
        onConfirm(modal.client.id, { name, phone });
    };

    // Estilos Dinámicos
    const theme = {
        bg: darkMode ? 'bg-[#161B28]' : 'bg-white',
        text: darkMode ? 'text-white' : 'text-slate-800',
        inputBg: darkMode ? 'bg-black/20' : 'bg-slate-50',
        border: darkMode ? 'border-white/5' : 'border-slate-100',
        inputBorder: darkMode ? 'border-white/10' : 'border-slate-200',
        subtext: darkMode ? 'text-slate-400' : 'text-slate-500',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className={`w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 ${theme.bg}`}>
                
                {/* HEADER */}
                <div className={`px-6 py-5 border-b flex justify-between items-center ${theme.border}`}>
                    <div>
                        <h3 className={`text-xl font-black ${theme.text}`}>Editar Cliente</h3>
                        <p className={`text-xs font-bold uppercase tracking-widest ${theme.subtext}`}>Actualizar Datos</p>
                    </div>
                    <button 
                        onClick={() => setModal({ ...modal, show: false })}
                        className={`p-2 rounded-full transition-colors ${darkMode ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* BODY */}
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Nombre del Cliente</label>
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input 
                                type="text" 
                                className={`w-full p-3 pl-11 rounded-xl font-bold text-sm outline-none border transition-all focus:border-indigo-500 ${theme.inputBg} ${theme.inputBorder} ${theme.text}`}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Nombre"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>WhatsApp / Teléfono</label>
                        <div className="relative group">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input 
                                type="text" 
                                className={`w-full p-3 pl-11 rounded-xl font-bold text-sm outline-none border transition-all focus:border-indigo-500 ${theme.inputBg} ${theme.inputBorder} ${theme.text}`}
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Teléfono"
                            />
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className={`p-4 border-t flex gap-3 ${theme.border} ${darkMode ? 'bg-black/20' : 'bg-slate-50'}`}>
                    <button 
                        onClick={() => setModal({ ...modal, show: false })}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${darkMode ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-600'}`}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Save size={18}/> Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditClientModal;