// src/components/Toast.jsx

import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

const icons = {
    success: <CheckCircle size={20} className="text-emerald-500" />,
    error: <XCircle size={20} className="text-red-500" />,
    warning: <AlertTriangle size={20} className="text-amber-500" />,
};

const Toast = ({ notification, setNotification }) => {
    
    // Auto-cierre después de 4 segundos
    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => {
                setNotification({ show: false, message: '', type: 'success' });
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [notification.show, setNotification]);

    if (!notification.show) return null;

    const baseClass = "fixed bottom-4 right-4 z-[999] p-4 rounded-xl shadow-2xl transition-all duration-300 transform flex items-center gap-3 w-full max-w-xs";
    
    const colors = {
        success: 'bg-white border border-emerald-100',
        error: 'bg-white border border-red-100',
        warning: 'bg-white border border-amber-100',
    };

    return (
        <div className={`${baseClass} ${colors[notification.type || 'success']}`}>
            <div className="flex-shrink-0">
                {icons[notification.type || 'success']}
            </div>
            <p className="flex-1 text-sm font-medium text-slate-800">
                {notification.message}
            </p>
            <button 
                onClick={() => setNotification({ show: false, message: '', type: 'success' })}
                className="text-slate-400 hover:text-slate-600 p-1"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;