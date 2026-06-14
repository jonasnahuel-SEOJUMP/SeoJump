import React from "react";

export default function PrivacyModal({ onClose, playClick }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 max-w-2xl w-full text-slate-200 shadow-2xl relative">
        <h2 className="text-3xl font-black text-duo-green mb-4">Política de Privacidad</h2>
        <div className="space-y-5 text-sm font-semibold leading-relaxed max-h-[60vh] overflow-y-auto pr-2 text-slate-350">
          <p className="text-xs text-slate-500">Última actualización: Junio 2026</p>
          
          <p>En SEO Jump valoramos la privacidad y la transparencia en el uso de datos.</p>
          
          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Qué datos usamos</h3>
            <p>Al iniciar sesión con Google: email, nombre y foto de perfil. Con tu permiso, leemos Search Console (clics, impresiones, posiciones, keywords y URLs). También guardamos tu progreso en el juego.</p>
            <p className="text-slate-450 font-bold mt-2">Solo lectura — nunca modificamos tu Search Console.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Inteligencia Artificial</h3>
            <p>Usamos Google Gemini para generar sugerencias. Tus datos se envían solo para procesar tu pedido, no para publicidad ni entrenamiento propio.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Cómo borrar tus datos</h3>
            <p>Podés revocar el acceso en <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-duo-green underline">tu cuenta de Google</a>, o <a href="/perfil" className="text-duo-green underline">entar a tu Perfil</a> (con sesión iniciada) y usar &quot;Eliminar mi cuenta y borrar mis datos&quot;. También podés escribir a nahuel@seo-jump.ai.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Google API Services</h3>
            <p>Cumplimos la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-duo-green underline hover:text-green-300">Política de Datos de Usuario de los Servicios API de Google</a> (Limited Use).</p>
          </div>

          <p className="text-duo-green font-bold">
            <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline">Ver política completa →</a>
          </p>
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
