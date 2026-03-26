import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export const ErrorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const error = searchParams.get('message') || 'Ocurrió un error inesperado.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-zinc-700 mb-6 break-words">{error}</p>
        <button 
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
};
