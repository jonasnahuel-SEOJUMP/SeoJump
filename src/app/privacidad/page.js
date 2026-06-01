import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad — SEO Jump",
  description: "Política de privacidad y uso de datos de SEO Jump.",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-[#07070d] font-fredoka text-slate-200 px-4 py-16 flex flex-col items-center">
      <div className="max-w-2xl w-full">
        <Link href="/" className="text-duo-green hover:underline text-sm font-bold mb-8 inline-block">
          ← Volver al inicio
        </Link>

        <h1 className="text-4xl font-black text-white mb-2">Política de Privacidad</h1>
        <p className="text-xs text-slate-500 mb-10">Última actualización: Mayo 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <p>En SEO Jump valoramos la privacidad y la transparencia en el uso de datos.</p>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Información que utilizamos</h2>
            <p>SEO Jump utiliza acceso de solo lectura a Google Search Console para analizar el rendimiento orgánico de sitios web y generar recomendaciones SEO automatizadas.</p>
            <p>Los datos a los que accedemos pueden incluir:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Clics</li>
              <li>Impresiones</li>
              <li>Posiciones</li>
              <li>Consultas de búsqueda</li>
              <li>URLs y métricas relacionadas</li>
            </ul>
            <p className="font-bold text-slate-300">SEO Jump no modifica configuraciones ni contenido dentro de Google Search Console.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Cómo utilizamos la información</h2>
            <p>La información obtenida se utiliza exclusivamente para:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Analizar oportunidades SEO</li>
              <li>Detectar mejoras potenciales</li>
              <li>Generar insights automatizados</li>
              <li>Mostrar estadísticas y progreso dentro de la plataforma</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Almacenamiento de datos</h2>
            <p>Parte de la información puede almacenarse temporalmente en el navegador del usuario (<code className="text-emerald-400 font-bold">localStorage</code>) para mantener configuraciones, progreso y funcionalidades de la aplicación.</p>
            <p className="font-bold text-slate-300">SEO Jump no vende datos de usuarios ni comparte información de Google Search Console con terceros con fines comerciales.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Servicios de terceros</h2>
            <p>SEO Jump puede utilizar proveedores externos de infraestructura y servicios de inteligencia artificial para procesar información y generar recomendaciones automatizadas.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Seguridad</h2>
            <p>Utilizamos conexiones seguras y medidas razonables de protección para resguardar la información procesada por la aplicación.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Control del usuario</h2>
            <p>Los usuarios pueden revocar el acceso de SEO Jump a Google Search Console en cualquier momento desde la configuración de su cuenta de Google.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Cumplimiento con Google API Services</h2>
            <p>El uso y transferencia de información recibida desde Google APIs por parte de SEO Jump cumple con la{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 underline hover:text-emerald-300"
              >
                Política de Datos de Usuario de los Servicios API de Google
              </a>.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Contacto</h2>
            <p>Si tenés preguntas sobre esta política de privacidad, podés contactarnos a través de:</p>
            <p className="text-emerald-400 font-bold">contacto@seojump.ai</p>
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
