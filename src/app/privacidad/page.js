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
        <p className="text-xs text-slate-500 mb-10">Última actualización: Junio 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          <p>En SEO Jump valoramos la privacidad, la seguridad y la total transparencia en el tratamiento de la información.</p>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">1. Información que recopilamos</h2>
            <p>SEO Jump recopila y utiliza los siguientes tipos de información:</p>

            <p className="text-white font-bold">a) Datos de tu cuenta de Google (al iniciar sesión)</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Dirección de correo electrónico.</li>
              <li>Nombre y foto de perfil públicos de Google.</li>
              <li>Token de acceso OAuth para mantener tu sesión activa (no almacenamos tu contraseña de Google).</li>
            </ul>

            <p className="text-white font-bold mt-4">b) Datos de Google Search Console (solo lectura)</p>
            <p>Con tu autorización explícita, SEO Jump accede en modo de solo lectura a la API de Google Search Console para analizar el rendimiento orgánico del sitio web que vinculás. Los datos incluyen:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Clics e impresiones totales.</li>
              <li>Posiciones medias en los resultados de búsqueda.</li>
              <li>Consultas de búsqueda (palabras clave) que atraen tráfico.</li>
              <li>URLs de las páginas del sitio y sus métricas de rendimiento relacionadas.</li>
            </ul>
            <p className="text-slate-400 bg-slate-800/50 border border-slate-700 rounded-xl p-4 mt-2">
              <strong className="text-white">Nota importante:</strong> SEO Jump lee tus métricas de rendimiento y, en funciones específicas de indexación, puede enviar solicitudes de rastreo. Nunca modifica la propiedad de tu dominio ni el contenido de tu sitio dentro de Search Console.
            </p>

            <p className="text-white font-bold mt-4">c) Datos de uso de la aplicación</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>URL del sitio web que ingresás para analizar.</li>
              <li>Progreso de misiones, XP acumulado y palabra clave activa.</li>
              <li>Historial de misiones completadas y sugerencias generadas.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">2. Cómo utilizamos la información</h2>
            <p>Los datos obtenidos se procesan exclusivamente en beneficio del usuario para proveer las funcionalidades visibles en la interfaz de la aplicación:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Analizar y detectar oportunidades SEO y de Answer Engine Optimization (AEO).</li>
              <li>Generar misiones y recomendaciones de optimización personalizadas.</li>
              <li>Mostrar estadísticas de progreso dentro del panel de usuario.</li>
              <li>Recordar tu avance entre sesiones para no repetir tareas ya completadas.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">3. Uso de Inteligencia Artificial (Google Gemini)</h2>
            <p>Para generar sugerencias de títulos, descripciones y misiones optimizadas, SEO Jump envía de forma cifrada (HTTPS) fragmentos de datos de tu sitio y de Search Console al servicio de inteligencia artificial <strong className="text-white">Google Gemini</strong>.</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Los datos se envían únicamente para procesar tu solicitud y devolverte una recomendación concreta.</li>
              <li>No utilizamos tus datos para entrenar modelos de IA propios ni para fines publicitarios.</li>
              <li>El procesamiento se realiza bajo los términos de uso de la API de Google AI.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">4. Almacenamiento y transferencia de datos</h2>
            <p>Tus datos se guardan en los siguientes lugares:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong className="text-slate-300">Tu navegador</strong> (<code className="text-emerald-400 font-bold">localStorage</code>): progreso, XP, misiones y URL del sitio, para una experiencia fluida.</li>
              <li><strong className="text-slate-300">Servidores en la nube</strong> (Supabase / Vercel): perfil, email y historial de misiones completadas, asociados a tu cuenta de Google.</li>
            </ul>
            <p>SEO Jump no vende, alquila ni comparte datos de usuarios de Google con terceros con fines comerciales o publicitarios.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">5. Tiempo de conservación de los datos</h2>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Mientras tu cuenta esté activa, conservamos tu perfil y progreso para que puedas retomar donde lo dejaste.</li>
              <li>Si eliminás tu cuenta (ver sección 7), borramos tus datos de nuestros servidores de forma inmediata.</li>
              <li>Los datos en tu navegador permanecen hasta que los borrés manualmente o uses la opción de eliminación de cuenta.</li>
              <li>Los registros técnicos del servidor (logs de errores) pueden conservarse hasta 90 días con fines de seguridad y diagnóstico, sin incluir el contenido de tus datos de Search Console.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">6. Cumplimiento con la Política de Google API Services</h2>
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
            <p className="text-slate-400">En concreto: solo usamos los datos de Google para proveer las funciones de SEO Jump que el usuario solicitó, no los compartimos con terceros salvo lo estrictamente necesario para operar el servicio (infraestructura y procesamiento de IA), y no los usamos para publicidad.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">7. Cómo eliminar tus datos</h2>
            <p>Tenés control total sobre tu información. Podés actuar de tres formas:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li>
                <strong className="text-slate-300">Revocar acceso a Google:</strong>{" "}
                entrá a{" "}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">myaccount.google.com/permissions</a>
                {" "}y quitá el permiso de SEO Jump. Esto corta el acceso a Search Console de inmediato.
              </li>
              <li>
                <strong className="text-slate-300">Eliminar cuenta desde la app:</strong>{" "}
                <Link href="/perfil" className="text-emerald-400 underline">entá a tu Perfil</Link>
                {" "}(necesitás iniciar sesión con Google). Una vez adentro, tocá la foto de tu cuenta arriba a la derecha en el dashboard, o usá el enlace directo. Ahí encontrás el botón{" "}
                <em>&quot;Eliminar mi cuenta y borrar mis datos&quot;</em>. Esto borra tu perfil, misiones completadas y progreso guardado en nuestros servidores y en tu navegador.
              </li>
              <li>
                <strong className="text-slate-300">Solicitud por email:</strong>{" "}
                si no podés acceder a la app, escribinos a{" "}
                <a href="mailto:nahuel@seo-jump.ai" className="text-emerald-400 underline">nahuel@seo-jump.ai</a>
                {" "}desde el mismo correo con el que te registraste. Respondemos y procesamos la eliminación en un plazo máximo de 30 días.
              </li>
            </ul>
            <p className="text-slate-400 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <strong className="text-white">Importante:</strong> eliminar tu cuenta en SEO Jump no cancela automáticamente una suscripción de pago en Mobbex, si la tuvieras activa. Eso debés gestionarlo por separado en Mobbex o contactándonos.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">8. Seguridad</h2>
            <p>Implementamos conexiones seguras mediante protocolo HTTPS y medidas de protección técnica para resguardar la información procesada.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-black text-lg">9. Contacto</h2>
            <p>El responsable legal del desarrollo y tratamiento de datos de esta plataforma es <strong className="text-white">Nahuel Cosentino</strong>.</p>
            <p>Para cualquier consulta legal, técnica o sobre el ejercicio de tus derechos de privacidad, podés contactarnos de forma directa a:</p>
            <p className="text-emerald-400 font-bold text-base">nahuel@seo-jump.ai</p>
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
