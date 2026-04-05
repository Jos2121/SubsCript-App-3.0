import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger',
  loading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-600',
          button: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:ring-red-500',
          iconBg: 'bg-red-100',
        };
      case 'warning':
        return {
          icon: 'text-yellow-600',
          button: 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 focus:ring-yellow-500',
          iconBg: 'bg-yellow-100',
        };
      case 'info':
        return {
          icon: 'text-blue-600',
          button: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500',
          iconBg: 'bg-blue-100',
        };
    }
  };

  const colors = getColors();

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 animate-slide-in">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-auto transform transition-all duration-300">
        <div className="p-6">
          <div className="flex items-start">
            <div className={`flex-shrink-0 ${colors.iconBg} rounded-xl p-3`}>
              <AlertTriangle className={`w-6 h-6 ${colors.icon}`} />
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {title}
              </h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                {message}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 transition-all duration-200"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={loading}
                  className={`inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-xl text-white ${colors.button} focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 shadow-lg transition-all duration-200`}
                >
                  {loading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  {confirmText}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="ml-4 text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50 rounded-lg p-1 hover:bg-gray-100 transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
