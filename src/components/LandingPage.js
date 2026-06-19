import React from "react";
import Link from "next/link";

export default function LandingPage({ onStart, playClick }) {
  const handleStart = () => {
    if (playClick) playClick();
    onStart();
  };

  const scrollToHow = (e) => {
    e.preventDefault();
    if (playClick) playClick();
    document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="w-full text-slate-100 font-fredoka flex flex-col items-center max-w-7xl mx-auto animate-in fade-in zoom-in duration-500">

      {/* ═══ HERO — Espía como gancho principal ═══ */}
      <section className="w-full flex flex-col items-center text-center py-12 md:py-20 px-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-500/10 blur-[120px] rounded-full pointer-events-none" />

        <span className="relative px-4 py-1.5 bg-red-500/20 border border-red-400/40 rounded-full text-red-200 text-xs md:text-sm font-black uppercase tracking-widest mb-6">
          🕵️ Espía de la Competencia
        </span>

        <img src="/images/logo-full.png" alt="SEO Jump" className="relative w-40 md:w-52 h-auto object-contain mb-6 drop-shadow-2xl" />

        <h1 className="relative text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.08] max-w-4xl mb-6">
          Pegá la web de tu rival.{" "}
          <span className="text-duo-green">Te decimos qué hace mejor</span>{" "}
          — y qué cambiar hoy en la tuya.
        </h1>

        <p className="relative text-slate-300 font-semibold text-lg md:text-xl leading-relaxed max-w-2xl mb-8">
          Sin Semrush. Sin informes de 50 páginas. Sin ser consultor SEO.
          <br />
          <span className="text-slate-400 text-base md:text-lg">
            Comparación en castellano, brechas accionables y misiones para ejecutar en minutos.
          </span>
        </p>

        <div className="relative flex flex-col sm:flex-row items-center gap-4 w-full justify-center mb-6">
          <button
            onClick={handleStart}
            className="btn-3d btn-green text-lg md:text-xl px-8 py-5 w-full sm:w-auto transform hover:scale-105 transition-all"
          >
            🕵️ Espiar a mi competidor gratis
          </button>
          <a
            href="#como-funciona"
            onClick={scrollToHow}
            className="text-slate-400 hover:text-white font-bold underline underline-offset-4 decoration-slate-600 transition-colors py-4"
          >
            ▶ Ver cómo funciona
          </a>
        </div>

        <p className="relative text-slate-500 text-sm font-bold">
          Plan gratis · 2 consultas IA/día · Sin tarjeta
        </p>
      </section>

      {/* ═══ DEMO VISUAL — Resultado tipo Espía ═══ */}
      <section className="w-full px-4 pb-16">
        <div className="max-w-3xl mx-auto rounded-3xl border-2 border-purple-500/40 bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-900 p-6 md:p-8 shadow-[0_0_60px_rgba(139,92,246,0.2)]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🦉</span>
            <span className="text-xs font-black uppercase tracking-wider text-purple-300">Ejemplo de resultado</span>
          </div>
          <p className="text-white font-bold text-base md:text-lg mb-4 leading-relaxed">
            &ldquo;Tu rival usa un título más claro con la ciudad y el servicio. Vos hablás de tu marca; ellos hablan de lo que busca el cliente.&rdquo;
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Tu web</p>
              <p className="text-xs text-slate-300 font-bold">H1: &ldquo;Bienvenidos a Mi Taller&rdquo;</p>
            </div>
            <div className="bg-red-950/40 rounded-xl p-3 border border-red-500/30">
              <p className="text-[10px] font-black uppercase text-red-400 mb-1">Rival</p>
              <p className="text-xs text-slate-200 font-bold">H1: &ldquo;Detailing Profesional en Córdoba&rdquo;</p>
            </div>
          </div>
          <div className="bg-duo-green/10 border border-duo-green/30 rounded-xl p-3">
            <p className="text-xs font-black text-duo-green uppercase mb-1">✅ Tu misión de hoy</p>
            <p className="text-sm text-slate-200 font-semibold">Cambiá el H1 para incluir servicio + zona. Te guiamos paso a paso en WordPress.</p>
          </div>
        </div>
      </section>

      {/* ═══ 3 PASOS — Espía ═══ */}
      <section id="como-funciona" className="w-full py-16 px-4 flex flex-col items-center text-center scroll-mt-8">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
          Tres pasos. Cinco minutos. Sin dashboard.
        </h2>
        <p className="text-slate-400 text-lg max-w-xl mb-12">
          No monitoreamos de noche ni te mandamos alertas mágicas. Vos pegás la URL cuando querés y la IA compara al toque.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl text-left">
          <div className="bg-slate-800/60 border-2 border-slate-700 rounded-2xl p-6">
            <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center font-black text-lg mb-4">1</div>
            <h3 className="text-lg font-black text-white mb-2">Pegás la URL del rival</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Ej: <span className="text-slate-300 font-bold">competencia.com</span>. Elegí al que te gana en Google para la búsqueda que te importa.
            </p>
          </div>
          <div className="bg-slate-800/60 border-2 border-slate-700 rounded-2xl p-6">
            <div className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-black text-lg mb-4">2</div>
            <h3 className="text-lg font-black text-white mb-2">La IA compara las dos webs</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Lee título, H1 y temas de tu rival y los cruza con los tuyos. Sin gráficos raros: un veredicto en castellano.
            </p>
          </div>
          <div className="bg-slate-800/60 border-2 border-duo-green/40 rounded-2xl p-6">
            <div className="w-10 h-10 bg-duo-green text-white rounded-full flex items-center justify-center font-black text-lg mb-4">3</div>
            <h3 className="text-lg font-black text-white mb-2">Ejecutás hasta 3 brechas</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Te dice qué cambiar y por qué. Si volvés a espiar al mismo rival, te avisamos si movió título o contenido.
            </p>
          </div>
        </div>

        <button
          onClick={handleStart}
          className="btn-3d btn-yellow text-base md:text-lg px-8 py-4 mt-10 font-black"
        >
          Probar el Espía gratis →
        </button>
      </section>

      {/* ═══ VS — Tres columnas honestas ═══ */}
      <section className="w-full py-16 px-4">
        <h2 className="text-3xl md:text-4xl font-black text-center text-white mb-4">
          No competimos con dashboards. Competimos con la parálisis.
        </h2>
        <p className="text-slate-400 text-center max-w-2xl mx-auto mb-10 text-lg">
          Semrush cuesta una fortuna. Otras apps SEO son otro panel más. SEO Jump te dice qué hacer hoy.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Semrush / Ahrefs</p>
            <h3 className="text-lg font-black text-slate-300 mb-4">El laboratorio (~$140+/mes)</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>✓ Keywords y backlinks a escala</li>
              <li>✓ Para agencias y consultores</li>
              <li className="text-red-400/90">✗ Abrumador para una PyME</li>
              <li className="text-red-400/90">✗ Te da datos, no la tarea del martes</li>
            </ul>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Otra app SEO</p>
            <h3 className="text-lg font-black text-slate-300 mb-4">Otro dashboard más</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>✓ Gráficos y métricas bonitas</li>
              <li>✓ IA que resume cosas</li>
              <li className="text-red-400/90">✗ Mismo problema: ¿y ahora qué?</li>
              <li className="text-red-400/90">✗ Hecho por devs, para devs</li>
            </ul>
          </div>
          <div className="bg-duo-green/5 border-2 border-duo-green/40 rounded-2xl p-6 relative">
            <p className="text-xs font-black uppercase tracking-wider text-duo-green mb-3">SEO Jump</p>
            <h3 className="text-lg font-black text-white mb-4">Tu socio de ejecución</h3>
            <ul className="space-y-2 text-sm text-slate-200">
              <li>✓ Espía: rival vs vos en segundos</li>
              <li>✓ Misiones concretas (H1, meta, FAQ)</li>
              <li>✓ Datos reales de Search Console</li>
              <li>✓ Gratis para empezar · PRO accesible</li>
            </ul>
            <Link
              href="/precios"
              onClick={playClick}
              className="inline-block mt-4 text-duo-green text-sm font-black hover:underline"
            >
              Ver planes →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ EL PROBLEMA — Reframed ═══ */}
      <section className="w-full py-16 px-4">
        <div className="bg-slate-900 p-8 md:p-12 rounded-3xl border-2 border-slate-700 shadow-2xl max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-6 text-center">
            Tenés datos. Tenés rival. No tenés tiempo para ser consultor SEO.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">😰</span>
              <div>
                <h3 className="font-black text-red-400">Parálisis</h3>
                <p className="text-slate-400 text-sm mt-1">Abrís Search Console, ves números, cerrás la pestaña. Nadie te traduce eso a una acción.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">🥊</span>
              <div>
                <h3 className="font-black text-orange-400">Rival invisible</h3>
                <p className="text-slate-400 text-sm mt-1">Sabés que te ganan en Google pero no qué hacen distinto en su web. Semrush es overkill para averiguarlo.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <h3 className="font-black text-amber-400">Informes que generan trabajo</h3>
                <p className="text-slate-400 text-sm mt-1">50 páginas de auditoría. Cero claridad sobre el único cambio que movería la aguja esta semana.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">⏱️</span>
              <div>
                <h3 className="font-black text-purple-400">Cero tiempo</h3>
                <p className="text-slate-400 text-sm mt-1">Sos dueño de negocio, no especialista. Necesitás 15 minutos libres y una misión clara.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SISTEMA COMPLETO — Después del gancho ═══ */}
      <section className="w-full py-16 px-4">
        <h2 className="text-3xl md:text-4xl font-black text-center text-white mb-3">
          El Espía abre la puerta. El juego te hace quedarte.
        </h2>
        <p className="text-slate-400 text-center max-w-2xl mx-auto mb-12">
          SEO Jump no es solo espiar rivales: es un sistema para ejecutar SEO sin volverte experto.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-red-500/30">
            <div className="text-3xl mb-3">🕵️</div>
            <h3 className="text-lg font-black text-white mb-2">Espía de la Competencia</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Compará tu web con un rival. Brechas accionables en castellano. Incluido en PRO, sin cargo extra.</p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-orange-500/30">
            <div className="text-3xl mb-3">🔎</div>
            <h3 className="text-lg font-black text-white mb-2">Quick Wins</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Páginas en posición 8–15 con demanda real. La IA sugiere el título que te empuja al Top 3.</p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-purple-500/30">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="text-lg font-black text-white mb-2">Oportunidades AEO</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Contenido listo para ser citado por ChatGPT y Gemini. El SEO del futuro, sin jerga.</p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-duo-green/30">
            <div className="text-3xl mb-3">🎮</div>
            <h3 className="text-lg font-black text-white mb-2">Misiones + verificación</h3>
            <p className="text-slate-400 text-sm leading-relaxed">H1, meta, FAQs. Aplicás el cambio, verificamos que quedó en vivo, sumás XP. Acción, no PDF.</p>
          </div>
        </div>
      </section>

      {/* ═══ GAMIFICACIÓN — Espía primero ═══ */}
      <section className="w-full py-16 px-4 flex flex-col items-center">
        <h2 className="text-2xl md:text-3xl font-black text-center text-white mb-8">
          Misiones que cualquiera entiende
        </h2>
        <div className="flex flex-col gap-3 w-full max-w-2xl">
          <div className="bg-slate-800 border-2 border-red-500/40 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center text-xl flex-shrink-0">🕵️</div>
              <div className="min-w-0">
                <h4 className="font-black text-white text-sm md:text-base">Espía de la Competencia</h4>
                <p className="text-slate-400 text-xs md:text-sm">Compará tu web con un rival y cerrá brechas.</p>
              </div>
            </div>
            <span className="bg-slate-900 px-2 py-1 rounded-full border border-slate-700 text-yellow-500 font-black text-xs flex-shrink-0">+15 XP</span>
          </div>
          <div className="bg-slate-800 border-2 border-slate-700 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center text-xl flex-shrink-0">🏆</div>
              <div className="min-w-0">
                <h4 className="font-black text-white text-sm md:text-base">Captura de Tráfico</h4>
                <p className="text-slate-400 text-xs md:text-sm">Optimizá el título de una página en zona de ataque.</p>
              </div>
            </div>
            <span className="bg-slate-900 px-2 py-1 rounded-full border border-slate-700 text-yellow-500 font-black text-xs flex-shrink-0">+20 XP</span>
          </div>
          <div className="bg-slate-800 border-2 border-slate-700 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-xl flex-shrink-0">🤖</div>
              <div className="min-w-0">
                <h4 className="font-black text-white text-sm md:text-base">Blindaje AEO</h4>
                <p className="text-slate-400 text-xs md:text-sm">Estructurá contenido para que la IA te cite.</p>
              </div>
            </div>
            <span className="bg-slate-900 px-2 py-1 rounded-full border border-slate-700 text-yellow-500 font-black text-xs flex-shrink-0">+30 XP</span>
          </div>
        </div>
      </section>

      {/* ═══ PARA QUIÉN ═══ */}
      <section className="w-full py-12 px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {[
            { emoji: "📍", title: "PyMEs y negocios locales", desc: "Showroom, taller, tienda online — sin agencia ni Semrush." },
            { emoji: "📦", title: "E-commerce chico", desc: "Sabé qué hace mejor la ficha de producto del rival." },
            { emoji: "💼", title: "Agencias", desc: "Onboarding rápido de clientes con Search Console." },
            { emoji: "✍️", title: "Freelancers", desc: "Entregá acciones, no informes kilométricos." },
          ].map((item) => (
            <div key={item.title} className="bg-slate-900/80 p-5 rounded-xl border border-slate-800">
              <h3 className="font-black text-white text-sm mb-1">{item.emoji} {item.title}</h3>
              <p className="text-slate-400 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="w-full py-16 px-4 max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black text-center text-white mb-8">Preguntas frecuentes</h2>
        <div className="space-y-4">
          {[
            {
              q: "¿El Espía reemplaza a Semrush?",
              a: "No para keyword research masivo ni backlinks. Sí para la pregunta típica de una PyME: «¿qué hace mejor este competidor en su web y qué cambio yo?». Eso cuesta $140/mes en suites pro; acá está incluido en el plan.",
            },
            {
              q: "¿Monitorean mi competencia de noche?",
              a: "No. El Espía es on-demand: vos pegás la URL cuando querés. Si volvés a espiar al mismo rival, comparamos con la visita anterior y te avisamos si cambió algo.",
            },
            {
              q: "¿Necesito conectar Search Console?",
              a: "Para el Espía podés comparar dos webs sin GSC. Para Quick Wins y misiones con tus datos reales de Google, sí — es la fuente de verdad y la conexión es segura vía OAuth.",
            },
            {
              q: "¿Cuánto cuesta?",
              a: "Gratis para empezar (1 rival, 2 consultas IA/día). PRO incluye Espía + más rivales y consultas, sin módulos extra. Ver precios en /precios.",
            },
          ].map((item) => (
            <div key={item.q} className="bg-slate-900 p-5 rounded-xl border border-slate-800">
              <h3 className="font-black text-white text-sm md:text-base mb-2">{item.q}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
        <p className="text-center mt-6">
          <Link
            href="/blog/como-espiar-competencia-google-sin-semrush"
            onClick={playClick}
            className="text-cyan-400 font-bold text-sm hover:underline"
          >
            Leé la guía completa: espiar competencia sin Semrush →
          </Link>
        </p>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="w-full py-16 px-4 mb-8">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-red-950/50 via-slate-900 to-purple-950/50 border-2 border-red-500/30 p-10 md:p-14 rounded-3xl text-center shadow-2xl">
          <h3 className="text-2xl md:text-4xl font-black text-white mb-4">
            Tu rival ya está en Google. ¿Vos qué estás esperando?
          </h3>
          <p className="text-slate-300 text-base md:text-lg mb-8 max-w-lg mx-auto">
            Pegá su URL. Enter. Tres brechas. Una misión. Sin dashboard de la NASA.
          </p>
          <button
            onClick={handleStart}
            className="btn-3d btn-green text-lg md:text-xl px-8 py-5 w-full max-w-md mx-auto block transform hover:scale-105 transition-all"
          >
            🕵️ Espiar a mi competidor gratis
          </button>
          <p className="text-slate-500 text-xs mt-6">
            Al registrarte aceptás nuestros{" "}
            <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Términos</a>
            {" "}y{" "}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Privacidad</a>.
          </p>
        </div>
      </section>

      <footer className="w-full border-t border-slate-800 py-8 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} SEO Jump. Todos los derechos reservados.</p>
        <div className="flex flex-wrap gap-4 justify-center mt-4">
          <Link href="/precios" onClick={playClick} className="hover:text-slate-300 transition-colors">Precios</Link>
          <Link href="/blog" onClick={playClick} className="hover:text-slate-300 transition-colors">Academia SEO</Link>
          <a href="/terminos" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Términos</a>
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Privacidad</a>
          <a href="mailto:nahuel@seo-jump.ai" className="hover:text-slate-300 transition-colors">Contacto</a>
        </div>
      </footer>
    </div>
  );
}
