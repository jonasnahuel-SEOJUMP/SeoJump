import Link from "next/link";

export const metadata = {
  title: "Términos y Condiciones — SEO Jump",
  description: "Términos y condiciones del servicio de SEO Jump.",
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[#07070d] font-fredoka text-slate-200 px-4 py-16 flex flex-col items-center">
      <div className="max-w-2xl w-full">
        <Link href="/" className="text-amber-400 hover:underline text-sm font-bold mb-8 inline-block">
          ← Volver al inicio
        </Link>

        <h1 className="text-4xl font-black text-white mb-2">Términos y Condiciones</h1>
        <p className="text-xs text-slate-500 mb-10">Última actualización: Mayo 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <p>Bienvenido a SEO Jump, el software de optimización SEO gamificado.</p>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Uso del servicio</h2>
            <p>Al conectar tu cuenta de Google, nos otorgás permiso de solo lectura para acceder a tus datos de Search Console con el fin de generar las misiones del juego.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Responsabilidad</h2>
            <p>Las recomendaciones proporcionadas por SEO Jump son sugerencias basadas en buenas prácticas de la industria. <strong className="text-white">Toda modificación que realices en tu sitio web es bajo tu propia responsabilidad.</strong> No garantizamos posiciones específicas en los resultados de búsqueda de Google.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Impacto real</h2>
            <p>El uso de este software implica la aceptación de que el juego tiene consecuencias reales en tu posicionamiento orgánico. Cada misión que completás representa un cambio real en tu sitio web.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Propiedad intelectual</h2>
            <p>Todo el contenido, diseño y funcionalidad de la plataforma SEO Jump son propiedad de sus creadores. Queda prohibida su reproducción o redistribución sin autorización expresa.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Modificaciones</h2>
            <p>SEO Jump se reserva el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigencia al momento de su publicación en esta página.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">Contacto</h2>
            <p>Para consultas sobre estos términos, podés contactarnos en:</p>
            <p className="text-amber-400 font-bold">contacto@seojump.ai</p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800">
          <Link href="/" className="inline-block bg-amber-500 hover:bg-amber-400 text-white font-black px-8 py-3 rounded-full transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
