import Link from "next/link";

export const metadata = {
  title: "Términos y Condiciones — SEO Jump",
  description: "Términos y condiciones de uso de la plataforma SEO Jump. Información legal sobre suscripciones, responsabilidad y propiedad intelectual.",
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[#07070d] font-fredoka text-slate-200 px-4 py-16 flex flex-col items-center">
      <div className="max-w-2xl w-full">
        <Link href="/" className="text-amber-400 hover:underline text-sm font-bold mb-8 inline-block">
          ← Volver al inicio
        </Link>

        <h1 className="text-4xl font-black text-white mb-2">Términos y Condiciones de Uso</h1>
        <p className="text-xs text-slate-500 mb-10">Última actualización: Junio 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          <p>Bienvenido a SEO Jump. Estos Términos y Condiciones de Uso regulan el acceso y la utilización de la plataforma web y los servicios ofrecidos en este sitio. Al registrarte, conectar tu cuenta de Google o utilizar nuestra aplicación, aceptás de forma expresa y sin reservas los presentes Términos en su totalidad. Si no estás de acuerdo con alguna de estas disposiciones, deberás abstenerte de utilizar la plataforma.</p>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">1. Identificación del Responsable</h2>
            <p>La plataforma SEO Jump, su marca, código fuente, activos visuales y sistemas automatizados son de propiedad exclusiva de <strong className="text-white">Nahuel Cosentino</strong>, con domicilio legal en la ciudad de Villa Carlos Paz, Córdoba, Argentina, y dirección de correo electrónico de contacto <span className="text-amber-400">nahuel@seo-jump.ai</span>.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">2. Descripción del Servicio</h2>
            <p>SEO Jump es un software en la nube (SaaS) que gamifica la optimización para motores de búsqueda (SEO) y motores de respuesta por Inteligencia Artificial (AEO). A través de la conexión segura y de solo lectura con la API de Google Search Console del usuario, el sistema analiza el rendimiento del sitio web y genera un listado de tareas ("Misiones") interactivas y sugerencias semánticas automatizadas para que el usuario las aplique en su propia página web.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">3. Registro y Conexión de Cuentas</h2>
            <p>Para utilizar las funciones avanzadas de la plataforma, el usuario debe iniciar sesión de forma segura utilizando su cuenta de Google.</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li>El usuario es el único responsable de mantener la confidencialidad de sus credenciales de acceso.</li>
              <li>El usuario garantiza que es propietario legítimo del sitio web vinculado o que cuenta con las autorizaciones explícitas para gestionar los datos de Google Search Console de dicho sitio.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">4. Suscripciones, Pagos y Precios</h2>
            <div className="space-y-3">
              <p><strong className="text-white">Modelo de Servicio:</strong> SEO Jump ofrece acceso limitado de forma gratuita ("Versión Gratuita") y acceso completo a todas las misiones y sugerencias mediante una suscripción de pago mensual ("Plan Premium" o "Beta Fundadores").</p>
              <p><strong className="text-white">Procesamiento de Pagos:</strong> Los pagos en Argentina se procesan de forma externa y segura a través de Mobbex. Los pagos internacionales pueden procesarse vía Stripe. SEO Jump no almacena ni tiene acceso a los datos de tus tarjetas de crédito o débito.</p>
              <p><strong className="text-white">Renovación Automática:</strong> La suscripción mensual se renovará automáticamente cada mes a menos que canceles antes de la fecha de facturación correspondiente.</p>
              <p><strong className="text-white">Política de Cancelación:</strong> Podés cancelar tu suscripción en cualquier momento desde tu cuenta de Mobbex o escribiendo a nahuel@seo-jump.ai. Al cancelar, mantendrás el acceso Premium hasta finalizar el período facturado en curso.</p>
              <p className="text-slate-400 bg-slate-800/50 border border-slate-700 rounded-xl p-4"><strong className="text-white">Reembolsos:</strong> Debido a la naturaleza digital del software y al acceso inmediato a los análisis e insights automatizados desde el momento del pago, no se realizan reembolsos ni devoluciones de dinero por períodos de suscripción ya facturados o parcialmente utilizados.</p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">5. Limitación de Responsabilidad</h2>
            <div className="space-y-3">
              <p><strong className="text-white">Naturaleza de las Recomendaciones:</strong> SEO Jump provee misiones y sugerencias basadas en análisis de datos generados por Inteligencia Artificial. Estas misiones actúan como sugerencias de optimización técnica y semántica.</p>
              <p><strong className="text-white">Garantía de Resultados:</strong> El posicionamiento en los motores de búsqueda (Google) y la citación en motores de respuesta (ChatGPT, Gemini) dependen de algoritmos externos, factores de mercado y la competencia. Por lo tanto, SEO Jump no garantiza posiciones exactas, aumentos específicos de tráfico orgánico, ni incrementos en la facturación o ventas del negocio del usuario tras aplicar las misiones.</p>
              <p><strong className="text-white">Uso del Código:</strong> El usuario es el único responsable de la implementación final de los textos, títulos o modificaciones sugeridas en su propio CMS (WordPress, Shopify, Tiendanube, etc.). SEO Jump no se responsabiliza por errores cometidos por el usuario durante la edición de su sitio web.</p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">6. Propiedad Intelectual</h2>
            <p>Todos los derechos de propiedad intelectual sobre la interfaz de usuario, el software, el logotipo del búho, los nombres comerciales, los textos explicativos, los algoritmos de optimización y el diseño general de SEO Jump pertenecen exclusivamente a <strong className="text-white">Nahuel Cosentino</strong>. Queda estrictamente prohibida su reproducción, copia, distribución o ingeniería inversa sin autorización expresa por escrito.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">7. Modificaciones de los Términos</h2>
            <p>Nos reservamos el derecho de actualizar o modificar estos Términos y Condiciones en cualquier momento para adaptarlos a novedades legales o cambios en las funciones del software. Las modificaciones entrarán en vigencia inmediatamente después de su publicación en el sitio web. El uso continuado de la aplicación tras una modificación constituye la aceptación de los nuevos Términos.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">8. Jurisdicción y Ley Aplicable</h2>
            <p>Para la resolución de cualquier conflicto derivado de la interpretación, validez o cumplimiento de estos Términos, el usuario y el responsable de la plataforma se someten expresamente a las leyes de la República Argentina y a la jurisdicción de los tribunales ordinarios de la ciudad de Villa Carlos Paz, Córdoba, Argentina, renunciando a cualquier otro fuero que pudiera corresponderles.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">9. Contacto</h2>
            <p>Si tenés alguna duda o consulta respecto a estos Términos y Condiciones, podés escribirnos en cualquier momento a:</p>
            <p className="text-amber-400 font-bold text-base">nahuel@seo-jump.ai</p>
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
