import React from "react";

export default function TermsModal({ onClose, playClick }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 max-w-2xl w-full text-slate-200 shadow-2xl relative">
        <h2 className="text-3xl font-black text-duo-yellow mb-4">Términos del Servicio</h2>
        <div className="space-y-4 text-sm font-semibold leading-relaxed">
          <p>Bienvenido a SEOJUMP, el software de optimización SEO gamificado.</p>
          <p>Al conectar tu cuenta de Google, nos otorgas permiso de solo lectura para acceder a tus datos de Search Console con el fin de generar las misiones del juego.</p>
          <p>Ten en cuenta que las recomendaciones proporcionadas por SEOJUMP son sugerencias basadas en buenas prácticas de la industria. <strong className="text-white">Toda modificación que realices en tu sitio web es bajo tu propia responsabilidad.</strong> No garantizamos posiciones específicas en los resultados de búsqueda de Google.</p>
          <p>El uso de este software implica la aceptación de que el juego tiene consecuencias reales en tu posicionamiento orgánico.</p>
        </div>
        <button 
          onClick={() => { if (playClick) playClick(); onClose(); }} 
          className="mt-8 btn-3d btn-white w-full py-3 text-slate-800"
        >
          CERRAR
        </button>
      </div>
    </div>
  );
}
