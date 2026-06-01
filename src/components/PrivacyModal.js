import React from "react";

export default function PrivacyModal({ onClose, playClick }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 max-w-2xl w-full text-slate-200 shadow-2xl relative">
        <h2 className="text-3xl font-black text-duo-green mb-4">Política de Privacidad</h2>
        <div className="space-y-5 text-sm font-semibold leading-relaxed max-h-[60vh] overflow-y-auto pr-2 text-slate-350">
          <p className="text-xs text-slate-500">Última actualización: Mayo 2026</p>
          
          <p>En SEO Jump valoramos la privacidad y la transparencia en el uso de datos.</p>
          
          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Información que utilizamos</h3>
            <p>SEO Jump utiliza acceso de solo lectura a Google Search Console para analizar el rendimiento orgánico de sitios web y generar recomendaciones SEO automatizadas.</p>
            <p>Los datos a los que accedemos pueden incluir:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Clics</li>
              <li>Impresiones</li>
              <li>Posiciones</li>
              <li>Consultas de búsqueda</li>
              <li>URLs y métricas relacionadas</li>
            </ul>
            <p className="text-slate-450 font-bold mt-2">SEO Jump no modifica configuraciones ni contenido dentro de Google Search Console.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Cómo utilizamos la información</h3>
            <p>La información obtenida se utiliza exclusivamente para:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Analizar oportunidades SEO</li>
              <li>Detectar mejoras potenciales</li>
              <li>Generar insights automatizados</li>
              <li>Mostrar estadísticas y progreso dentro de la plataforma</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Almacenamiento de datos</h3>
            <p>Parte de la información puede almacenarse temporalmente en el navegador del usuario (<code className="text-duo-yellow font-bold">localStorage</code>) para mantener configuraciones, progreso y funcionalidades de la aplicación.</p>
            <p className="text-slate-450 font-bold mt-2">SEO Jump no vende datos de usuarios ni comparte información de Google Search Console con terceros con fines comerciales.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Servicios de terceros</h3>
            <p>SEO Jump puede utilizar proveedores externos de infraestructura y servicios de inteligencia artificial para procesar información y generar recomendaciones automatizadas.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Seguridad</h3>
            <p>Utilizamos conexiones seguras y medidas razonables de protección para resguardar la información procesada por la aplicación.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Control del usuario</h3>
            <p>Los usuarios pueden revocar el acceso de SEO Jump a Google Search Console en cualquier momento desde la configuración de su cuenta de Google.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Cumplimiento con Google API Services</h3>
            <p>El uso y transferencia de información recibida desde Google APIs por parte de SEO Jump cumple con la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-duo-green underline hover:text-green-300">Política de Datos de Usuario de los Servicios API de Google</a>.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-black text-base">Contacto</h3>
            <p>Si tenés preguntas sobre esta política de privacidad, podés contactarnos a través de:</p>
            <p className="text-duo-green font-bold">contacto@seojump.ai</p>
          </div>
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
