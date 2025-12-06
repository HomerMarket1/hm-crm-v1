// src/components/Toast.jsx (ESTILO CRISTAL FLOTANTE)

import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const Toast = ({ notification, setNotification }) => {
    
    // Auto-cerrar después de 3 segundos
    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => {
                setNotification(prev => ({ ...prev, show: false }));
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification.show, setNotification]);

    if (!notification.show) return null;

    // Configuración visual según el tipo
    const styles = {
        success: {
            bg: "bg-emerald-50/90 border-emerald-100",
            text: "text-emerald-800",
            icon: <CheckCircle className="text-emerald-500" size={20} />
        },
        error: {
            bg: "bg-rose-50/90 border-rose-100",
            text: "text-rose-800",
            icon: <XCircle className="text-rose-500" size={20} />
        },
        warning: {
            bg: "bg-amber-50/90 border-amber-100",
            text: "text-amber-800",
            icon: <AlertTriangle className="text-amber-500" size={20} />
        },
        info: {
            bg: "bg-blue-50/90 border-blue-100",
            text: "text-blue-800",
            icon: <Info className="text-blue-500" size={20} />
        }
    };

    const currentStyle = styles[notification.type] || styles.info;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md border ${currentStyle.bg}`}>
                <div className="shrink-0">{currentStyle.icon}</div>
                <p className={`text-sm font-bold ${currentStyle.text} pr-2`}>
                    {notification.message}
                </p>
                <button 
                    onClick={() => setNotification(prev => ({ ...prev, show: false }))}
                    className="p-1 hover:bg-black/5 rounded-full transition-colors"
                >
                    <X size={14} className={currentStyle.text} opacity={0.5}/>
                </button>
            </div>
        </div>
    );
};

export default Toast;