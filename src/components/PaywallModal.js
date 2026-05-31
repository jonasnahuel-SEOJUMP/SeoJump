import React, { useState } from "react";

export default function PaywallModal({ onClose, totalHiddenMissions, playClick }) {
  const [loading, setLoading] = useState(false);

  const handleCheckoutMercadoPago = () => {
    if (playClick) playClick();
    setLoading(true);
    
    // Simulate Mercado Pago checkout delay
    setTimeout(() => {
      alert("Redirigiendo a Mercado Pago para Suscripción...");
      // Here you would integrate the real MercadoPago redirect/API call
      // Example: window.location.href = "YOUR_MP_INIT_POINT_URL";
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Decoración superior */}
        <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-br from-duo-green/20 to-teal-500/10 blur-2xl pointer-events-none"></div>

        <button 
          onClick={(e) => { e.stopPropagation(); if (playClick) playClick(); onClose(); }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-3xl transition-colors z-10"
        >
          ✕
        </button>

        <div className="p-8 text-center relative z-10">
          <div className="w-16 h-16 mx-auto bg-green-500/20 text-duo-green rounded-2xl flex items-center justify-center text-3xl border border-green-500/40 mb-6 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            🔓
          </div>
          
          <h2 className="text-2xl md:text-3xl font-black text-white mb-4 leading-tight">
            Desbloqueá el análisis completo y activá las <span className="text-duo-green">{totalHiddenMissions}</span> oportunidades ocultas de tu web
          </h2>
          
          <p className="text-slate-400 font-medium text-base mb-8">
            Estás a un paso de acceder a todas las misiones detalladas para escalar tu tráfico en Google, ChatGPT y Gemini.
          </p>

          <div className="bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 mb-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-duo-green"></div>
            
            <div className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2 line-through decoration-slate-500 decoration-2">
              Precio Normal: $49.900 / mes
            </div>
            
            <div className="flex justify-center items-end gap-2 mb-2">
              <span className="text-4xl md:text-5xl font-black text-white">$24.900</span>
              <span className="text-slate-400 font-bold mb-1">/ mes</span>
            </div>
            
            <div className="inline-block px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs font-black uppercase rounded-full mt-2">
              ⭐ Precio Beta Fundadores (Cupos Limitados)
            </div>
          </div>

          <button 
            onClick={handleCheckoutMercadoPago}
            disabled={loading}
            className="w-full btn-3d btn-green !py-4 text-lg md:text-xl font-black flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generando pago..." : "DESBLOQUEAR AHORA"}
          </button>
          
          <p className="text-slate-500 text-xs font-bold mt-6 flex items-center justify-center gap-2">
            🔒 Pago seguro procesado por Mercado Pago
          </p>

        </div>
      </div>
    </div>
  );
}
