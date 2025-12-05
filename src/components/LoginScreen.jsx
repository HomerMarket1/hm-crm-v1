// src/components/LoginScreen.jsx (CÓDIGO COMPLETO)

import React from 'react';

const LoginScreen = ({ loginEmail, setLoginEmail, loginPass, setLoginPass, loginError, handleLogin }) => {
    return (
        // ✅ CORTAR Y PEGAR ESTE BLOQUE
        <div className="flex h-screen items-center justify-center bg-[#F2F2F7] p-4">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl w-full max-w-sm text-center">
                <div className="w-24 h-24 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/20 bg-white p-2">
                    {/* Asegúrate de que la ruta al logo sea correcta */}
                    <img src="/logo1.png" alt="HM" className="w-full h-full object-contain rounded-xl"/>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Bienvenido</h2>
                <p className="text-slate-500 mb-8 text-sm">Sistema de Gestión HM Digital</p>
                
                {/* El formulario utiliza la prop `handleLogin` pasada desde App.jsx */}
                <form onSubmit={handleLogin} className="space-y-4">
                    <input 
                        type="email" 
                        placeholder="Correo" 
                        className="w-full p-4 bg-[#F2F2F7] rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-medium" 
                        value={loginEmail} 
                        onChange={e=>setLoginEmail(e.target.value)} 
                        required
                    />
                    <input 
                        type="password" 
                        placeholder="Contraseña" 
                        className="w-full p-4 bg-[#F2F2F7] rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-medium" 
                        value={loginPass} 
                        onChange={e=>setLoginPass(e.target.value)} 
                        required
                    />
                    {loginError && <p className="text-red-500 text-xs font-bold">{loginError}</p>}
                    <button type="submit" className="w-full py-4 bg-[#007AFF] text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-opacity">Entrar</button>
                </form>
            </div>
        </div>
    );
};

export default LoginScreen;