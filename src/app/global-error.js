'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#07070d] text-slate-100 p-6">
        <h1 className="text-2xl font-black">Algo salió mal</h1>
        <p className="text-slate-400 text-center max-w-md">
          Ya registramos el error. Podés reintentar o volver al inicio.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-purple-600 font-bold hover:bg-purple-500"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-lg border border-slate-600 font-bold hover:bg-slate-800"
          >
            Ir al inicio
          </a>
        </div>
      </body>
    </html>
  );
}
