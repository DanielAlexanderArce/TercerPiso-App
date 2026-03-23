import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'info'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl border border-zinc-100"
          >
            <div className="flex items-center space-x-4 mb-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-900'
              }`}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900">{title}</h3>
                <p className="text-zinc-500 text-sm mt-1">{message}</p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 text-zinc-600 font-semibold hover:bg-zinc-100 rounded-xl transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-3 text-white font-semibold rounded-xl transition-all shadow-md active:scale-[0.98] ${
                  type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-zinc-900 hover:bg-zinc-800 shadow-zinc-200'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
