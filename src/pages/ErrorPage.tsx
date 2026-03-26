import React from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

export const ErrorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Try to get error from location state first, then search params
  const stateError = location.state?.error;
  const searchError = searchParams.get('message');
  
  let errorMessage = 'Ocurrió un error inesperado.';
  
  if (stateError) {
    if (typeof stateError === 'string') {
      errorMessage = stateError;
    } else if (stateError.message) {
      errorMessage = stateError.message;
    } else {
      try {
        errorMessage = JSON.stringify(stateError, null, 2);
      } catch (e) {
        errorMessage = String(stateError);
      }
    }
  } else if (searchError) {
    errorMessage = searchError;
  }

  // If the error is "[object Event]", it's useless, so we provide a fallback
  if (errorMessage.includes('[object Event]') || errorMessage.includes('[objeto Evento]')) {
    errorMessage = 'Error de red o de carga de archivo. Por favor verifica tu conexión e intenta de nuevo.';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <div className="mb-4 flex justify-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-red-600 mb-2">Error de Carga</h1>
        <p className="text-zinc-500 text-sm mb-4">No se pudo completar la operación</p>
        <div className="bg-red-50 p-4 rounded-md mb-6 text-left overflow-auto max-h-48">
          <p className="text-red-800 text-sm font-mono break-words whitespace-pre-wrap">{errorMessage}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => navigate(-1)}
            className="w-full px-4 py-2 bg-zinc-100 text-zinc-900 rounded-md hover:bg-zinc-200 transition-colors font-medium"
          >
            Intentar de nuevo
          </button>
          <button 
            onClick={() => navigate('/')}
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors font-medium"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
};
