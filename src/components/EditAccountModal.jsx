// src/components/EditAccountModal.jsx

import React from 'react';

const EditAccountModal = ({ modal, setModal, onConfirm }) => {
    if (!modal.show) return null;

    const handleInputChange = (e) => {
        setModal(prev => ({
            ...prev,
            newPass: e.target.value
        }));
    };

    const handleConfirm = () => {
        // Ejecutar la acción de edición
        onConfirm();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl transition-all scale-100 opacity-100">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                    Editar Contraseña de Cuenta
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                    Cuenta: <span className="font-semibold">{modal.email}</span>
                </p>

                {/* ✅ CAMPO PARA LA NUEVA CONTRASEÑA */}
                <div className="mb-6">
                    <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Nueva Contraseña
                    </label>
                    <input
                        id="new-password"
                        type="text"
                        value={modal.newPass}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        placeholder="Ingresa la nueva contraseña"
                    />
                </div>

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={() => setModal({ show: false })}
                        className="px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
                        disabled={!modal.newPass || modal.newPass === modal.oldPass}
                    >
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditAccountModal;