import React from "react";
import Link from "next/link";
import PublicComprehension from "./PublicComprehension";

/** Landing principal (AEO + misiones diarias). variant="spy" solo para /espia-competencia (ads). */
export default function LandingPage({ onStart, playClick, variant = "default" }) {
  const handleStart = () => {
    if (playClick) playClick();
    onStart();
  };

  const scrollToHow = (e) => {
    e.preventDefault();
    if (playClick) playClick();
    document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToMapa = (e) => {
    e.preventDefault();
    if (playClick) playClick();
    document.getElementById("mapa-ia")?.scrollIntoView({ behavior: "smooth" });
  };

  if (variant === "spy") {
    return (
      <div className="w-full text-slate-100 font-fredoka flex flex-col items-center max-w-7xl mx-auto animate-in fade-in zoom-in duration-500">
        <section className="w-full flex flex-col items-center text-center py-12 md:py-20 px-4 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-500/10 blur-[120px] rounded-full pointer-events-none" />
          <span className="relative px-4 py-1.5 bg-red-500/20 border border-red-400/40 rounded-full text-red-200 text-xs md:text-sm font-black uppercase tracking-widest mb-6">
            🕵️ Espía de la Competencia
          </span>
          <img src="/images/logo-full.png" alt="SEO Jump" className="relative w-40 md:w-52 h-auto object-contain mb-6 drop-shadow-2xl" />
          <h1 className="relative text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.08] max-w-4xl mb-6">
            Pegá la web de tu rival.{" "}
            <span className="text-duo-green">Te decimos qué hace mejor</span> — y qué cambiar hoy en la tuya.
          </h1>
          <p className="relative text-slate-300 font-semibold text-lg md:text-xl leading-relaxed max-w-2xl mb-8">
            Sin Semrush. Sin informes de 50 páginas. Comparación en castellano y misiones para ejecutar en minutos.
          </p>
          <button
            onClick={handleStart}
            className="btn-3d btn-green text-lg md:text-xl px-8 py-5 w-full sm:w-auto max-w-md transform hover:scale-105 transition-all"
          >
            🕵️ Espiar a mi competidor gratis
          </button>
          <p className="relative text-slate-500 text-sm font-bold mt-6">
            Parte de <Link href="/" onClick={playClick} className="text-duo-green hover:underline">SEO Jump</Link> — mejorá tu web cada día con misiones y AEO.
          </p>
        </section>
        <SpyFeatureBlock playClick={playClick} />
        <LandingFooter playClick={playClick} />
      </div>
    );
  }

  return (
    <div className="w-full text-slate-100 font-fredoka flex flex-col items-center max-w-7xl mx-auto animate-in fade-in zoom-in duration-500">

      {/* HERO — Espía de la competencia (gancho principal) */}
      <section className="w-full flex flex-col items-center text-center py-12 md:py-20 px-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-500/10 blur-[120px] rounded-full pointer-events-none" />
        <span className="relative px-4 py-1.5 bg-red-500/20 border border-red-400/40 rounded-full text-red-200 text-xs md:text-sm font-black uppercase tracking-widest mb-6">
          🕵️ Espiá a tu competencia en Google
        </span>
        <img src="/images/logo-full.png" alt="SEO Jump" className="relative w-48 md:w-64 h-auto object-contain mb-6 drop-shadow-2xl" />
        <h1 className="relative text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.1] max-w-4xl mb-6">
          Espiá a tu competencia.{" "}
          <span className="text-duo-green">Después ganásle</span> con una misión por día.
        </h1>
        <p className="relative text-slate-300 font-semibold text-lg md:text-2xl leading-relaxed max-w-3xl mb-10">
          Pegá la URL de un rival —sus pulidoras, sus microfibras, la página que quieras— y la IA te muestra{" "}
          <strong className="text-white">qué hace mejor que vos en Google</strong>. Desde ahí, SEO Jump te arma las{" "}
          <strong className="text-white">misiones diarias</strong> para cerrar esas brechas y aparecer también en{" "}
          <strong className="text-purple-400">ChatGPT y Gemini</strong>.
          <br />
          <span className="text-slate-400 text-base md:text-lg">Sin Semrush. Sin informes de 50 páginas. 15 minutos por día.</span>
        </p>

        <div className="relative flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <button
            onClick={handleStart}
            className="btn-3d btn-green text-xl md:text-2xl px-8 py-5 w-full sm:w-auto transform hover:scale-105 transition-all"
          >
            🕵️ Espiar a mi competencia gratis
          </button>
          <a
            href="#mapa-ia"
            onClick={scrollToMapa}
            className="btn-3d text-lg md:text-xl px-6 py-5 w-full sm:w-auto bg-cyan-500/10 border-2 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/20 hover:scale-105 transition-all font-black text-center"
          >
            🤖 Probar gratis sin registrarme
          </a>
        </div>
        <a
          href="#como-funciona"
          onClick={scrollToHow}
          className="relative text-slate-400 hover:text-white font-bold underline underline-offset-4 decoration-slate-600 transition-colors mt-5"
        >
          ▶ Ver cómo funciona
        </a>

        <div className="relative mt-8 flex flex-col items-center">
          <div className="flex text-yellow-400 text-xl mb-2">⭐⭐⭐⭐⭐</div>
          <p className="text-slate-400 text-sm font-medium max-w-xl">
            <strong className="text-slate-300">4.9/5</strong> – Negocios locales, e-commerce y profesionales que prefieren
            saber qué cambiar hoy antes que otro dashboard de SEO.
          </p>
        </div>
      </section>

      {/* ESPÍA — Explicación del gancho (cómo funciona espiar) */}
      <SpyHeroExplainer playClick={playClick} onStart={handleStart} />

      {/* GANCHO SECUNDARIO — ¿Las IA entienden tu página? (herramienta pública gratis, sin registro) */}
      <section id="mapa-ia" className="w-full px-4 pb-8 md:pb-16">
        <div className="relative rounded-3xl border-2 border-cyan-500/30 bg-gradient-to-b from-slate-900/80 to-slate-950 p-6 md:p-12 shadow-2xl overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="relative text-center mb-8">
            <span className="inline-block px-4 py-1.5 bg-purple-500/20 border border-purple-400/40 rounded-full text-purple-200 text-xs md:text-sm font-black uppercase tracking-widest mb-5">
              🤖 Gratis · Sin registro · Optimización para IA (AEO)
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-[1.1] max-w-3xl mx-auto mb-4">
              ¿Todavía no querés espiar? Empezá por tu propia web{" "}
              <span className="text-cyan-400">gratis.</span>
            </h2>
            <p className="text-slate-300 font-semibold text-base md:text-xl max-w-2xl mx-auto">
              Pegá tu URL y en segundos te mostramos qué entiende (y qué NO entiende){" "}
              <strong className="text-white">ChatGPT, Gemini y Google</strong> sobre tu negocio — sin crear cuenta.
            </p>
          </div>
          <PublicComprehension onRegister={handleStart} playClick={playClick} />
        </div>
      </section>

      {/* EL PROBLEMA */}
      <section className="w-full py-16 px-4">
        <div className="bg-slate-900 p-8 md:p-12 rounded-3xl border-2 border-slate-700 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500 opacity-5 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-3xl md:text-4xl font-black text-white mb-6 text-center md:text-left">
            Tu web pierde clientes ahora mismo. Y no sabés qué cambiar hoy.
          </h2>
          <p className="text-slate-300 text-lg mb-10 max-w-4xl text-center md:text-left">
            Miles de personas buscan en Google o le preguntan a una IA exactamente lo que vos vendés. El problema no es tu
            producto: es que nadie te traduce los datos en una acción concreta para esta semana.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border border-red-500/30">❌</div>
              <div>
                <h3 className="text-lg font-black text-red-400">Potencial enterrado</h3>
                <p className="text-slate-300 text-base mt-1.5">Páginas a un paso del Top 3 en Google que mueren en la página 2 porque nadie te dice qué título cambiar.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border border-red-500/30">❌</div>
              <div>
                <h3 className="text-lg font-black text-red-400">Parálisis por análisis</h3>
                <p className="text-slate-300 text-base mt-1.5">Search Console y herramientas caras te inundan de gráficos. Te quedás con la misma duda: ¿qué hago hoy?</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border border-red-500/30">❌</div>
              <div>
                <h3 className="text-lg font-black text-red-400">El punto ciego de la IA (AEO)</h3>
                <p className="text-slate-300 text-base mt-1.5">ChatGPT y Gemini ya recomiendan negocios. Si tu contenido no está estructurado para ellas, otro se queda con la cita.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border border-red-500/30">❌</div>
              <div>
                <h3 className="text-lg font-black text-red-400">Sin hábito de mejora</h3>
                <p className="text-slate-300 text-base mt-1.5">Sabés que tu web debería crecer, pero sin un plan diario termina siempre en "cuando tenga tiempo".</p>
              </div>
            </div>
          </div>
          <div className="mt-10 p-6 bg-duo-green/10 border border-duo-green/30 rounded-2xl text-center">
            <p className="text-xl font-bold text-duo-green">
              SEO Jump te da una misión por día: mejorás un poco, sumás XP, y tu web gana visibilidad en Google y en IA.
            </p>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="w-full py-16 px-4 flex flex-col items-center text-center scroll-mt-8">
        <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
          De datos complejos a una misión simple al día.
        </h2>
        <p className="text-slate-300 text-lg md:text-xl max-w-2xl mb-12">
          Pensado para dueños de negocio que valoran su tiempo, no para consultores SEO.
        </p>

        <div className="flex flex-col lg:flex-row items-center gap-12 w-full max-w-6xl">
          <div className="flex-1 w-full relative">
            <div className="absolute inset-0 bg-duo-blue/20 blur-3xl rounded-full" />
            <div className="relative bg-slate-800 border-2 border-slate-700 rounded-2xl shadow-2xl overflow-hidden aspect-[4/3] flex items-center justify-center">
              <img
                src="/images/landing-dashboard.jpg"
                alt="Panel de SEO Jump con misiones, oportunidades AEO y sugerencias con IA"
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>

          <div className="flex-1 space-y-8 text-left w-full">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center font-black shrink-0 text-xl shadow-lg border-2 border-red-400">1</div>
              <div>
                <h3 className="text-xl font-bold text-white">Espiás a tu competencia</h3>
                <p className="text-slate-400 mt-2">Pegás la URL de un rival —o de cada una de sus páginas clave— y la IA te dice qué hace mejor que vos.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-duo-blue text-white rounded-full flex items-center justify-center font-black shrink-0 text-xl shadow-lg border-2 border-blue-400">2</div>
              <div>
                <h3 className="text-xl font-bold text-white">Conectás tu Search Console</h3>
                <p className="text-slate-400 mt-2">En segundos, con tu cuenta de Google. Sumás tus datos reales para cruzarlos con lo que vimos del rival.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-black shrink-0 text-xl shadow-lg border-2 border-purple-400">3</div>
              <div>
                <h3 className="text-xl font-bold text-white">La IA detecta oportunidades</h3>
                <p className="text-slate-400 mt-2">Quick Wins en Google, oportunidades AEO para ChatGPT y Gemini, y las brechas contra tu competencia.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-duo-green text-white rounded-full flex items-center justify-center font-black shrink-0 text-xl shadow-lg border-2 border-green-400">4</div>
              <div>
                <h3 className="text-xl font-bold text-white">Completás misiones diarias</h3>
                <p className="text-slate-400 mt-2">Cambiás un título, un H1, un FAQ. Verificamos que quedó en vivo. Sumás XP. Mañana, otra misión.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFICIOS — AEO primero */}
      <section className="w-full py-16 px-4">
        <h2 className="text-3xl md:text-5xl font-black text-center text-white mb-4">
          Todo el poder de una agencia de SEO en un juego diario.
        </h2>
        <p className="text-slate-400 text-center max-w-2xl mx-auto mb-12 text-lg">
          Cada herramienta te empuja a mejorar un poco tu web hoy — no a mirar gráficos toda la tarde.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <div className="bg-slate-800/50 p-8 rounded-2xl border-2 border-red-500/40 hover:border-red-400/60 transition-colors">
            <div className="text-4xl mb-4">🕵️</div>
            <h3 className="text-xl font-bold text-white mb-3">Espía de la Competencia</h3>
            <p className="text-slate-400 leading-relaxed">
              Pegás la URL de un rival —cada producto o página que quieras— y la IA compara título, H1 y temas con tu web.
              El punto de partida: saber exactamente qué te gana hoy.
            </p>
          </div>
          <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-purple-500/50 transition-colors">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-white mb-3">Oportunidades AEO</h3>
            <p className="text-slate-400 leading-relaxed">
              Detectamos qué páginas pueden ser citadas por ChatGPT, Gemini y Google AI. El futuro del tráfico pasa por
              ser la respuesta — acá sabés cuál optimizar primero.
            </p>
          </div>
          <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-orange-500/50 transition-colors">
            <div className="text-4xl mb-4">🔎</div>
            <h3 className="text-xl font-bold text-white mb-3">Quick Wins (SEO)</h3>
            <p className="text-slate-400 leading-relaxed">
              Páginas en posición 8–15 con demanda real. La IA sugiere el título que te empuja al Top 3. Insight masticado,
              acción inmediata.
            </p>
          </div>
          <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-yellow-500/50 transition-colors">
            <div className="text-4xl mb-4">🎮</div>
            <h3 className="text-xl font-bold text-white mb-3">Misiones inteligentes</h3>
            <p className="text-slate-400 leading-relaxed">
              H1, meta, FAQs, verificación en vivo. Cada tarea es una misión clara. Completás, mejorás, sumás XP.
            </p>
          </div>
          <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-cyan-500/50 transition-colors">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-xl font-bold text-white mb-3">Score de visibilidad</h3>
            <p className="text-slate-400 leading-relaxed">
              Un indicador que muestra si vas ganando autoridad en Google y optimización para IA — de un vistazo.
            </p>
          </div>
        </div>
      </section>

      {/* AEO — Bloque estratégico */}
      <section className="w-full py-20 px-4">
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-8 md:p-14 rounded-3xl border border-purple-500/30 shadow-[0_0_50px_rgba(139,92,246,0.15)] text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20" />
          <h2 className="text-3xl md:text-5xl font-black text-white mb-8 relative z-10">
            El futuro no es solo aparecer en Google. Es <span className="text-purple-300">convertirse en la respuesta.</span>
          </h2>
          <p className="text-purple-100 text-lg md:text-xl max-w-4xl mx-auto leading-relaxed relative z-10 font-medium">
            Antes, el usuario elegía entre diez enlaces. Hoy, millones le preguntan a una IA y reciben una sola respuesta.
            Si alguien pregunta <em>«¿Cuál es el mejor servicio en mi zona?»</em>, la IA cita a quien demuestre claridad y
            autoridad. SEO Jump te da las pautas para ser vos ese negocio — con misiones concretas, no teoria.
            <br /><br />
            <strong>Estar en Google y en las IA ya no es opcional: es supervivencia comercial.</strong>
          </p>
          <Link
            href="/blog/que-es-aeo-y-por-que-aparecer-en-inteligencia-artificial"
            onClick={playClick}
            className="inline-block mt-8 relative z-10 text-purple-200 font-black text-sm hover:text-white underline underline-offset-4"
          >
            Leé qué es AEO y por qué importa →
          </Link>
        </div>
      </section>

      {/* HUMAN SCORE — Filosofía de diseño / métrica en evolución */}
      <HumanScoreBlock />

      {/* GAMIFICACIÓN */}
      <section className="w-full py-16 px-4 flex flex-col items-center">
        <h2 className="text-3xl md:text-5xl font-black text-center text-white mb-4">
          Olvidate de los tableros imposibles. Esto es un juego.
        </h2>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl text-center mb-12">
          Las agencias te cobran fortunas por reportes. Vos resolvés misiones en 15 minutos y tu web sube de nivel.
        </p>

        <div className="flex flex-col gap-4 w-full max-w-3xl">
          <MissionRow icon="🤖" color="purple" title="Blindaje contra IA" desc="Estructurá contenido para ser citado por Gemini." xp="+30 XP" />
          <MissionRow icon="🏆" color="yellow" title="Captura de tráfico" desc="Optimizá el título de una página en zona de ataque." xp="+20 XP" />
          <MissionRow icon="🕵️" color="red" title="Espía de la Competencia" desc="Compará tu web con un rival y cerrá brechas concretas." xp="+15 XP" />
          <MissionRow icon="⚔️" color="orange" title="Ataque a la competencia" desc="Aprovechá una keyword de oportunidad antes que tu rival." xp="+25 XP" />
        </div>
      </section>

      {/* ESPIA — Sección secundaria (no hero) */}
      <SpyFeatureBlock playClick={playClick} compact />

      {/* PARA QUIÉN ES */}
      <section className="w-full py-16 px-4">
        <h2 className="text-3xl md:text-5xl font-black text-center text-white mb-12">
          Para empresarios, profesionales y emprendedores que quieren resultados, no reportes.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <AudienceCard emoji="📍" title="Negocios locales & PyMEs" desc="Mejorá tu web sin código ni agencia. Una misión por día." border="blue" />
          <AudienceCard emoji="📦" title="E-commerce" desc="Optimizá fichas y categorías que pierden ventas por falta de SEO." border="orange" />
          <AudienceCard emoji="💼" title="Profesionales & freelancers" desc="Tu web trabaja por vos mientras atendés clientes." border="purple" />
          <AudienceCard emoji="✍️" title="Emprendedores & creadores" desc="Google + IA desde el día uno, sin volverte experto." border="green" />
        </div>
      </section>

      {/* DIFERENCIAL */}
      <section className="w-full py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-10">
            La mayoría te inunda con datos. SEO Jump te da la misión de hoy.
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-700 shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="bg-slate-800 p-4 md:p-6 text-slate-300 font-bold border-b border-slate-700 w-1/2">Otras plataformas (Semrush, Ahrefs)</th>
                  <th className="bg-duo-green/10 p-4 md:p-6 text-duo-green font-bold border-b border-duo-green/20 w-1/2">SEO Jump</th>
                </tr>
              </thead>
              <tbody className="bg-slate-900">
                <tr>
                  <td className="p-4 md:p-6 border-b border-slate-800 text-slate-400 text-sm md:text-base">Gráficos, keywords y dashboards para especialistas.</td>
                  <td className="p-4 md:p-6 border-b border-slate-800 text-white font-medium text-sm md:text-base bg-duo-green/5">Una misión clara por día en castellano.</td>
                </tr>
                <tr>
                  <td className="p-4 md:p-6 border-b border-slate-800 text-slate-400 text-sm md:text-base">Te dicen qué está mal; vos interpretás.</td>
                  <td className="p-4 md:p-6 border-b border-slate-800 text-white font-medium text-sm md:text-base bg-duo-green/5">Te decimos qué cambiar, por qué, y verificamos que lo hiciste.</td>
                </tr>
                <tr>
                  <td className="p-4 md:p-6 text-slate-400 text-sm md:text-base">$140+/mes y curva de aprendizaje alta.</td>
                  <td className="p-4 md:p-6 text-white font-medium text-sm md:text-base bg-duo-green/5">Gratis para empezar. Mejorás tu web un poco cada día.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section className="w-full py-16 px-4">
        <h2 className="text-3xl md:text-4xl font-black text-center text-white mb-12">Lo que dicen los primeros jugadores</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Testimonial quote="Tenía pánico de Search Console. Con SEO Jump descubrí páginas a nada del Top 3. Apliqué el cambio y el tráfico subió a la semana." author="Juan M., Tienda Online" />
          <Testimonial quote="Las oportunidades AEO son una locura. ChatGPT nos citó en dos artículos de servicios. El retorno fue inmediato." author="Carlos T., Consultor" />
          <Testimonial quote="El Espía de la Competencia me mostró en claro qué hacía mejor mi rival. Cambié el H1 y entendí por fin qué atacar." author="Usuario SEO Jump" />
        </div>
      </section>

      {/* FAQ */}
      <section className="w-full py-16 px-4 max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black text-center text-white mb-10">Preguntas frecuentes</h2>
        <div className="space-y-6">
          <Faq q="¿Tengo que ser experto en SEO?" a="No. SEO Jump traduce todo a instrucciones simples. Si sabés copiar, pegar y editar un texto en tu web, alcanza." />
          <Faq q="¿Qué diferencia hay entre SEO y AEO?" a="SEO = aparecer en los enlaces de Google. AEO = que ChatGPT y Gemini te citen como respuesta. SEO Jump trabaja ambos con misiones concretas." />
          <Faq q="¿Por qué conectar Search Console?" a="Es la fuente oficial de Google sobre tu web. Sin adivinar: usamos tus datos reales de clics, impresiones y posiciones. Además cruzamos esos datos con lo que vemos de tu competencia." />
          <Faq q="¿Cómo funciona el Espía de la Competencia?" a="Pegás la URL de un rival y la IA compara su web con la tuya: título, H1, temas e intención. Te dice qué hace mejor y qué cambiar hoy en la tuya. Es el punto de partida ideal — y desde ahí SEO Jump te arma las misiones diarias para superarlo." />
          <Faq q="¿Puedo espiar varias páginas del mismo competidor?" a="Sí. Podés espiar página por página: sus pulidoras, sus microfibras, cada categoría que te interese. Cada URL distinta cuenta como un espionaje. El plan gratis incluye 3 URLs, PRO llega a 15 y Agencia a 50. Volver a espiar la misma URL para ver cambios no consume un lugar nuevo." />
          <Faq q="¿Qué es el Human Score?" a="Es nuestra métrica en evolución que mide el valor humano de tu contenido: experiencia, evidencia propia, casos reales, opinión y datos. No detecta si un texto fue hecho con IA; mide si aporta algo que los demás no tienen. La vamos refinando con el uso real." />
          <Faq q="¿Qué es el Mapa de comprensión?" a="Te muestra qué entienden Google y las IA de una página (tipo, temas, preguntas, autor, empresa) y qué falta. Si tenés preguntas frecuentes, genera la estructura lista para pegar — sin pelearte con código técnico. El objetivo no es magia: es reducir ambigüedad para que te puedan citar." />
          <Faq q="¿Es seguro conectar Google?" a="Sí. OAuth oficial de Google. No vemos tu contraseña." />
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="w-full py-20 px-4 mb-10">
        <div className="max-w-4xl mx-auto bg-slate-900 border-2 border-duo-green/30 p-10 md:p-16 rounded-3xl text-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-duo-green/5 blur-xl pointer-events-none" />
          <h3 className="text-2xl md:text-4xl font-black text-white mb-6 relative z-10">
            Tu próximo cliente ya está buscando una respuesta.
          </h3>
          <p className="text-slate-300 text-lg md:text-xl mb-10 relative z-10">
            Empezá hoy con una misión. Mañana, otra. En un mes, una web que trabaja por vos en Google y en IA.
          </p>
          <div className="relative z-10 w-full max-w-md mx-auto">
            <button
              onClick={handleStart}
              className="btn-3d btn-green text-xl md:text-2xl px-6 py-5 w-full transform hover:scale-105 transition-all"
            >
              🚀 Empezar Gratis Ahora
            </button>
            <p className="text-slate-500 text-xs mt-6">
              Al registrarte aceptás nuestros{" "}
              <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Términos</a>
              {" "}y{" "}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Privacidad</a>.
            </p>
          </div>
        </div>
      </section>

      <LandingFooter playClick={playClick} />
    </div>
  );
}

/** Bloque Human Score — presentado como filosofía de diseño y métrica en evolución (no feature cerrada). */
function HumanScoreBlock() {
  const dims = [
    { emoji: "👤", label: "Experiencia" },
    { emoji: "📸", label: "Evidencia propia" },
    { emoji: "📈", label: "Casos reales" },
    { emoji: "⭐", label: "Opinión y criterio" },
    { emoji: "🔢", label: "Datos propios" },
    { emoji: "✨", label: "Originalidad" },
  ];
  return (
    <section className="w-full py-20 px-4">
      <div className="max-w-5xl mx-auto rounded-3xl border-2 border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/30 via-slate-900 to-slate-900 p-8 md:p-14 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-fuchsia-600 opacity-10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-fuchsia-500/15 border border-fuchsia-400/40 rounded-full text-fuchsia-200 text-xs md:text-sm font-black uppercase tracking-widest mb-6">
            🫀 Filosofía SEO Jump · Human Score
            <span className="px-2 py-0.5 bg-fuchsia-400/20 rounded-full text-[10px] tracking-wide">en evolución</span>
          </span>

          <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
            La IA ya escribe por todos. Lo que te diferencia es{" "}
            <span className="text-fuchsia-300">lo humano.</span>
          </h2>

          <p className="text-slate-300 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed font-medium mb-4">
            Hoy cualquiera genera un artículo con IA en 30 segundos. El problema ya no es escribir: es
            destacar entre los otros cien textos casi idénticos. Por eso SEO Jump no te dice{" "}
            <em>«no uses IA»</em>. Te ayuda a convertir un borrador en algo con valor real.
          </p>
          <p className="text-slate-400 text-base md:text-lg max-w-3xl mx-auto leading-relaxed mb-10">
            <strong className="text-white">La IA optimiza. Vos aportás lo irreemplazable.</strong>{" "}
            Estamos construyendo el <strong className="text-fuchsia-300">Human Score</strong>: una métrica
            que mide cuánto de eso tiene tu contenido. No detecta «si es IA» — detecta si aportás algo que
            el resto no tiene.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mx-auto mb-8">
            {dims.map((d) => (
              <div key={d.label} className="bg-slate-800/60 border border-fuchsia-500/20 rounded-xl px-4 py-3 flex items-center gap-2.5 text-left">
                <span className="text-2xl flex-shrink-0">{d.emoji}</span>
                <span className="text-sm md:text-base font-bold text-slate-200">{d.label}</span>
              </div>
            ))}
          </div>

          <p className="text-slate-500 text-sm max-w-2xl mx-auto mb-6">
            Es una métrica en desarrollo que vamos refinando con el uso real. Alineada con la dirección de
            Google (E-E-A-T) y de los asistentes de IA: premiar el contenido útil, original y con experiencia.
          </p>

          <Link
            href="/blog/contenido-humano-vs-ia-human-score"
            className="inline-block text-fuchsia-200 font-black text-sm hover:text-white underline underline-offset-4"
          >
            Leé nuestra visión sobre el contenido humano vs. IA →
          </Link>
        </div>
      </div>
    </section>
  );
}

function MissionRow({ icon, color, title, desc, xp }) {
  const bg = { purple: "bg-purple-500/20 text-purple-400 border-purple-500/30", yellow: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30", red: "bg-red-500/20 text-red-500 border-red-500/30", orange: "bg-orange-500/20 text-orange-400 border-orange-500/30" }[color];
  return (
    <div className="bg-slate-800 border-2 border-slate-700 rounded-xl p-5 flex items-center justify-between shadow-lg gap-3">
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl border flex-shrink-0 ${bg}`}>{icon}</div>
        <div className="min-w-0">
          <h4 className="font-bold text-white text-lg">{title}</h4>
          <p className="text-slate-400 text-sm">{desc}</p>
        </div>
      </div>
      <div className="bg-slate-900 px-3 py-1.5 rounded-full border border-slate-700 text-yellow-500 font-black text-sm whitespace-nowrap flex-shrink-0">{xp}</div>
    </div>
  );
}

function AudienceCard({ emoji, title, desc, border }) {
  const b = { blue: "border-l-blue-500", orange: "border-l-orange-500", purple: "border-l-purple-500", green: "border-l-duo-green" }[border];
  return (
    <div className={`bg-slate-900 p-6 rounded-2xl border-l-4 ${b} border border-slate-800`}>
      <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">{emoji} {title}</h3>
      <p className="text-slate-400">{desc}</p>
    </div>
  );
}

function Testimonial({ quote, author }) {
  return (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
      <div className="text-yellow-400 text-sm mb-3">⭐⭐⭐⭐⭐</div>
      <p className="text-slate-300 italic mb-4">&ldquo;{quote}&rdquo;</p>
      <p className="font-bold text-white text-sm">— {author}</p>
    </div>
  );
}

function Faq({ q, a }) {
  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
      <h3 className="text-lg font-bold text-white mb-2">{q}</h3>
      <p className="text-slate-400">{a}</p>
    </div>
  );
}

/** Explicación del gancho Espía — justo debajo del hero de la home. */
function SpyHeroExplainer({ playClick, onStart }) {
  const steps = [
    {
      n: "1",
      title: "Pegás la URL de tu rival",
      desc: "La página que quieras: su home, sus pulidoras, sus microfibras… cada URL que te interese.",
    },
    {
      n: "2",
      title: "La IA compara con tu web",
      desc: "Título, H1, temas e intención. En castellano, sin gráficos ni informes de 50 páginas.",
    },
    {
      n: "3",
      title: "Te decimos qué cambiar hoy",
      desc: "Convertimos cada brecha en una misión concreta que ejecutás en minutos y verificamos en vivo.",
    },
  ];
  return (
    <section className="w-full px-4 pb-4 md:pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {steps.map((s) => (
            <div key={s.n} className="bg-slate-900/70 border-2 border-slate-800 rounded-2xl p-6 text-left relative overflow-hidden">
              <div className="absolute -top-6 -right-4 text-7xl font-black text-red-500/10 select-none">{s.n}</div>
              <div className="w-9 h-9 bg-red-500 text-white rounded-full flex items-center justify-center font-black text-lg shadow-lg border-2 border-red-400 mb-3">
                {s.n}
              </div>
              <h3 className="text-lg font-bold text-white mb-1.5 relative z-10">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed relative z-10">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onStart}
            className="btn-3d btn-yellow font-black px-6 py-4 text-sm md:text-base w-full sm:w-auto"
          >
            🕵️ Empezar espiando gratis
          </button>
          <Link
            href="/blog/como-espiar-competencia-google-sin-semrush"
            onClick={playClick}
            className="text-cyan-400 font-bold text-sm hover:underline"
          >
            Guía: espiar competencia sin Semrush →
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Bloque Espía — secundario en home, principal en /espia-competencia */
function SpyFeatureBlock({ playClick, compact = false }) {
  return (
    <section className={`w-full px-4 ${compact ? "py-12" : "py-16"}`}>
      <div className="max-w-4xl mx-auto rounded-3xl border-2 border-red-500/30 bg-gradient-to-br from-slate-900 via-red-950/20 to-slate-900 p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-red-400">Por acá se empieza</span>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              🕵️ Espía de la Competencia
            </h2>
            <p className="text-slate-300 leading-relaxed">
              ¿Querés saber qué hace mejor un rival en Google? Pegá su URL —y la de cada página que te interese: pulidoras,
              microfibras, lo que vendas— y la IA compara título, H1 y temas con tu web, sin pagar Semrush. Es el mejor
              punto de partida antes de tus misiones diarias.
            </p>
            <Link
              href="/blog/como-espiar-competencia-google-sin-semrush"
              onClick={playClick}
              className="inline-block text-cyan-400 font-bold text-sm hover:underline"
            >
              Guía: espiar competencia sin Semrush →
            </Link>
          </div>
          <Link
            href="/espia-competencia"
            onClick={playClick}
            className="btn-3d btn-yellow text-center font-black px-6 py-4 text-sm md:text-base whitespace-nowrap flex-shrink-0"
          >
            Conocer el Espía →
          </Link>
        </div>
      </div>
    </section>
  );
}

function LandingFooter({ playClick }) {
  return (
    <footer className="w-full border-t border-slate-800 py-8 text-center text-slate-500 text-sm">
      <p>© {new Date().getFullYear()} SEO Jump. Todos los derechos reservados.</p>
      <div className="flex flex-wrap gap-4 justify-center mt-4">
        <Link href="/precios" onClick={playClick} className="hover:text-slate-300 transition-colors">Precios</Link>
        <Link href="/blog" onClick={playClick} className="hover:text-slate-300 transition-colors">Academia SEO</Link>
        <Link href="/espia-competencia" onClick={playClick} className="hover:text-slate-300 transition-colors">Espía de la Competencia</Link>
        <a href="/terminos" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Términos</a>
        <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Privacidad</a>
        <a href="mailto:nahuel@seo-jump.ai" className="hover:text-slate-300 transition-colors">Contacto</a>
      </div>
    </footer>
  );
}
