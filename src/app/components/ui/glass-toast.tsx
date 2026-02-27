import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { GlassCard } from './glass-components';

interface GlassToastProps {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    onClose: () => void;
}

export const GlassToast = ({ message, type, onClose }: GlassToastProps) => {
    const icons = {
        success: <CheckCircle className="h-5 w-5 text-emerald-400" />,
        error: <AlertCircle className="h-5 w-5 text-red-400" />,
        info: <Info className="h-5 w-5 text-blue-400" />,
        warning: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
    };

    const bgColors = {
        success: 'bg-emerald-500/10 border-emerald-500/20',
        error: 'bg-red-500/10 border-red-500/20',
        info: 'bg-blue-500/10 border-blue-500/20',
        warning: 'bg-yellow-500/10 border-yellow-500/20',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="pointer-events-auto"
        >
            <div className={`relative overflow-hidden rounded-xl border backdrop-blur-md shadow-lg p-4 pr-10 min-w-[300px] ${bgColors[type]}`}>
                <div className="flex items-start gap-3">
                    <div className="mt-0.5">{icons[type]}</div>
                    <div>
                        <p className="text-sm font-medium text-white">{message}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </motion.div>
    );
};
