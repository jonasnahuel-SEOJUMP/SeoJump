import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad — SEO Jump",
  description: "Política de privacidad y uso de datos de SEO Jump. Cumplimiento con Google API Services y protección de datos del usuario.",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-[#07070d] font-fredoka text-slate-200 px-4 py-16 flex flex-col items-center">
      <div className="max-w-2xl w-full">
        <Link href="/" className="text-emerald-400 hover:underline text-sm font-bold mb-8 inline-block">
          ← Volver al inicio
        </Link>

        <h1 className="text-4xl font-black text-white mb-2">Política de Privacidad</h1>
        <p className="text-xs text-slate-500 mb-10">Última actualización: Mayo 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          <p>En SEO Jump valoramos la privacidad, la seguridad y la total transparencia en el tratamiento de la información.</p>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">1. Información que utilizamos</h2>
            <p>SEO Jump utiliza acceso de solo lectura a la API de Google Search Console para analizar el rendimiento orgánico de los sitios web vinculados por el usuario y generar recomendaciones de optimización automatizadas.</p>
            <p>Los datos a los que accedemos de forma segura incluyen:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Clics e impresiones totales.</li>
              <li>Posiciones medias en los resultados de búsqueda.</li>
              <li>Consultas de búsqueda (palabras clave) que atraen tráfico.</li>
              <li>URLs de las páginas del sitio y sus métricas de rendimiento relacionadas.</li>
            </ul>
            <p className="text-slate-400 bg-slate-800/50 border border-slate-700 rounded-xl p-4 mt-2">
              <strong className="text-white">Nota importante:</strong> SEO Jump cuenta únicamente con permisos de lectura. La aplicación jamás modificará configuraciones, propiedad de dominios ni contenido dentro de tu cuenta de Google Search Console.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">2. Cómo utilizamos la información</h2>
            <p>Los datos obtenidos se procesan exclusivamente en beneficio del usuario para proveer las funcionalidades visibles en la interfaz de la aplicación, enfocadas en:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Analizar y detectar oportunidades SEO y de Answer Engine Optimization (AEO).</li>
              <li>Generar misiones y recomendaciones de optimización personalizadas.</li>
              <li>Mostrar estadísticas de progreso e ingresos potenciales dentro del panel de usuario.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">3. Almacenamiento y transferencia de datos</h2>
            <p>Parte de las configuraciones y el progreso del jugador se almacenan localmente en el navegador del usuario (<code className="text-emerald-400 font-bold">localStorage</code>) para garantizar una navegación fluida.</p>
            <p>SEO Jump no vende, alquila ni comparte datos de usuarios de Google con terceros con fines comerciales o publicitarios. Cualquier transferencia de datos a proveedores de infraestructura externa o servicios de inteligencia artificial (APIs de procesamiento de lenguaje) se realiza de forma cifrada y con el único propósito de estructurar las misiones optimizadas para el usuario, sin permitir que dichos sistemas utilicen la información para el entrenamiento de modelos globales.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">4. Cumplimiento con la Política de Google API Services</h2>
            <p>El uso y la transferencia de la información recibida desde las APIs de Google por parte de SEO Jump se adherirán a la{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 underline hover:text-emerald-300"
              >
                Política de Datos de Usuario de los Servicios API de Google
              </a>
              , incluyendo sus Requisitos de Uso Limitado (Limited Use Requirements).
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">5. Control del usuario y seguridad</h2>
            <p>Implementamos conexiones seguras mediante protocolo HTTPS y medidas de protección técnica para resguardar la información procesada. El usuario mantiene el control absoluto sobre sus datos y puede revocar el acceso de SEO Jump a su Google Search Console en cualquier momento, de forma instantánea, desde el panel de seguridad de su cuenta de Google.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">6. Contacto</h2>
            <p>Para cualquier consulta legal, técnica o sobre el ejercicio de tus derechos de privacidad, podés contactarnos de forma directa a:</p>
            <p className="text-emerald-400 font-bold text-base">contacto@seojump.ai</p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800">
          <Link href="/" className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 py-3 rounded-full transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
