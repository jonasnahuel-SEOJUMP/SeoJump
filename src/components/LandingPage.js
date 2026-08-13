"use client";

import React from "react";
import Link from "next/link";
import PublicComprehension from "./PublicComprehension";

/** Entrada genérica al dashboard (Route Handler /comenzar). El Espía usa form GET con ?spy=1&url=. */
const APP_ENTRY_HREF = "/comenzar";

/**
 * Landing Espía-first (estilo SpyFu / Meev / Morningscore):
 * 1) Hero = marca + 1 promesa + cajón de URL
 * 2) Cómo funciona el espionaje
 * 3) Puente a misiones diarias
 * 4) AEO secundario (herramienta gratis)
 * 5) Prueba social + FAQ + CTA
 *
 * variant="spy" = mini-landing para ads (/espia-competencia).
 */
export default function LandingPage({ onRegister, playClick, variant = "default" }) {
  const scrollTo = (id) => (e) => {
    e.preventDefault();
    if (playClick) playClick();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const StartCta = ({ className, children }) => (
    <a href={APP_ENTRY_HREF} onClick={() => playClick && playClick()} className={className} role="button">
      {children}
    </a>
  );

  if (variant === "spy") {
    return (
      <div className="w-full text-slate-100 font-fredoka flex flex-col items-center max-w-7xl mx-auto animate-in fade-in duration-500">
        <SpyHero playClick={playClick} compact />
        <HowSpyWorks />
        <section className="w-full px-4 pb-16 text-center">
          <p className="text-slate-500 text-sm font-bold">
            Parte de{" "}
            <Link href="/" onClick={playClick} className="text-duo-green hover:underline">
              SEO Jump
            </Link>{" "}
            — después del espionaje, una misión por día para superarlos.
          </p>
        </section>
        <LandingFooter playClick={playClick} />
      </div>
    );
  }

  return (
    <div className="w-full text-slate-100 font-fredoka flex flex-col items-center max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* 1. HERO — un solo gancho: Espía + cajón */}
      <SpyHero playClick={playClick} onHow={scrollTo("como-funciona")} />

      {/* 2. Cómo funciona el espionaje */}
      <HowSpyWorks />

      {/* 3. Puente — misiones (retención, no gancho) */}
      <section id="como-funciona" className="w-full py-16 md:py-20 px-4 scroll-mt-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Espiaste. Ahora <span className="text-duo-green">superarlos</span> es una misión por día.
          </h2>
          <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-semibold leading-relaxed">
            SEO Jump convierte cada brecha en una acción concreta: cambiás un título, un H1, un FAQ.
            Verificamos en vivo. Sumás XP. Mañana, otra.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-10">
            <BridgeCard n="1" title="Espías" desc="Pegás la URL del rival y ves qué te gana." />
            <BridgeCard n="2" title="Conectás GSC" desc="Tus datos reales de Google, sin adivinar." />
            <BridgeCard n="3" title="Misión diaria" desc="Una mejora clara. 15 minutos. Hecho." />
          </div>
          <StartCta className="btn-3d btn-green text-lg md:text-xl px-8 py-5 inline-flex transform hover:scale-105 transition-transform">
            Empezar con misiones gratis
          </StartCta>
        </div>
      </section>

      {/* 4. AEO secundario — cajón gratis sin registro */}
      <section id="mapa-ia" className="w-full px-4 pb-8 md:pb-16 scroll-mt-8">
        <div className="relative max-w-5xl mx-auto rounded-3xl border-2 border-cyan-500/25 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 md:p-10 overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[260px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative text-center mb-8">
            <p className="text-cyan-300/90 text-xs md:text-sm font-black uppercase tracking-widest mb-4">
              Después del Espía · Gratis sin registro
            </p>
            <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight leading-tight max-w-2xl mx-auto mb-3">
              ¿Las IA entienden tu página?
            </h2>
            <p className="text-slate-400 font-semibold text-base md:text-lg max-w-xl mx-auto">
              Pegá tu URL y mirá qué ven ChatGPT, Gemini y Google — y qué les falta.
            </p>
          </div>
          <PublicComprehension onRegister={onRegister} playClick={playClick} />
        </div>
      </section>

      {/* 5. Diferencial corto */}
      <section className="w-full py-12 md:py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-4">
            Semrush te tira datos. Nosotros te decimos qué cambiar hoy.
          </h2>
          <p className="text-slate-400 text-base md:text-lg font-medium leading-relaxed">
            Sin informes de 50 páginas. Sin jerga. Espías al rival, cerrás la brecha con una misión,
            y también trabajás para aparecer en ChatGPT y Gemini (AEO).
          </p>
        </div>
      </section>

      {/* 6. Prueba social */}
      <section className="w-full py-12 px-4">
        <h2 className="text-2xl md:text-3xl font-black text-center text-white mb-8">
          Lo que dicen los primeros jugadores
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto">
          <Testimonial
            quote="El Espía me mostró en claro qué hacía mejor mi rival. Cambié el H1 y entendí por fin qué atacar."
            author="Usuario SEO Jump"
          />
          <Testimonial
            quote="Tenía pánico de Search Console. Descubrí páginas a nada del Top 3 y apliqué el cambio en minutos."
            author="Juan M., Tienda Online"
          />
          <Testimonial
            quote="Las oportunidades AEO son una locura. ChatGPT nos citó en dos artículos de servicios."
            author="Carlos T., Consultor"
          />
        </div>
      </section>

      {/* 7. FAQ corto */}
      <section className="w-full py-12 md:py-16 px-4 max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black text-center text-white mb-8">Preguntas frecuentes</h2>
        <div className="space-y-4">
          <Faq
            q="¿Cómo funciona el Espía?"
            a="Pegás la URL de un rival. La IA compara título, H1, temas, FAQ y Schema con tu web, y te dice qué cambiar hoy. Después SEO Jump arma misiones diarias para cerrar esas brechas."
          />
          <Faq
            q="¿Puedo espiar varias páginas del mismo competidor?"
            a="Sí: home, categoría, cada ficha. Cada URL distinta cuenta. Plan gratis: 3 URLs. PRO: 15. Agencia: 50. Re-espiar la misma URL no consume un lugar nuevo."
          />
          <Faq
            q="¿Qué es AEO?"
            a="SEO = aparecer en los enlaces de Google. AEO = que ChatGPT y Gemini te citen. El mapa gratis de arriba te muestra qué entienden las IA de tu página."
          />
          <Faq
            q="¿Y el Human Score?"
            a="Métrica en evolución que mide valor humano del contenido (experiencia, evidencia, casos, opinión, datos). No detecta «si es IA»: mide si aportás algo que el resto no tiene. Vive dentro de la app."
          />
          <Faq q="¿Es seguro conectar Google?" a="Sí. OAuth oficial de Google. No vemos tu contraseña." />
        </div>
      </section>

      {/* 8. CTA final */}
      <section className="w-full py-16 md:py-20 px-4 mb-6">
        <div className="max-w-3xl mx-auto relative overflow-hidden rounded-3xl border-2 border-duo-green/30 bg-slate-900 p-10 md:p-14 text-center shadow-2xl">
          <div className="absolute inset-0 bg-duo-green/5 blur-xl pointer-events-none" />
          <h3 className="relative z-10 text-2xl md:text-4xl font-black text-white mb-4">
            Tu rival ya está en Google. ¿Y vos?
          </h3>
          <p className="relative z-10 text-slate-300 text-lg mb-8 font-medium">
            Pegá su URL. En minutos sabés qué te gana — y qué hacer hoy.
          </p>
          <div className="relative z-10 max-w-xl mx-auto">
            <SpyUrlForm playClick={playClick} size="md" />
            <p className="text-slate-500 text-xs mt-5">
              Al continuar aceptás nuestros{" "}
              <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">
                Términos
              </a>{" "}
              y{" "}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">
                Privacidad
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <LandingFooter playClick={playClick} />
    </div>
  );
}

/** Hero Espía: marca + promesa + cajón (patrón SpyFu / Meev). */
function SpyHero({ playClick, onHow, compact = false }) {
  return (
    <section
      className={`w-full flex flex-col items-center text-center px-4 relative ${
        compact ? "py-12 md:py-16" : "py-14 md:py-24"
      }`}
    >
      {/* Atmósfera */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(900px,100vw)] h-[420px] bg-gradient-to-b from-red-600/15 via-red-500/5 to-transparent blur-2xl" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#07070d] to-transparent" />
      </div>

      <img
        src="/images/logo-full.png"
        alt="SEO Jump"
        className={`relative h-auto object-contain drop-shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-700 ${
          compact ? "w-40 md:w-48 mb-5" : "w-48 md:w-64 mb-7"
        }`}
      />

      <h1
        className={`relative font-black text-white tracking-tight leading-[1.08] max-w-4xl mb-5 ${
          compact ? "text-3xl md:text-5xl" : "text-4xl md:text-6xl"
        }`}
      >
        Espiá a tu competencia.{" "}
        <span className="text-duo-green">Después superala.</span>
      </h1>

      <p
        className={`relative text-slate-300 font-semibold leading-relaxed max-w-2xl mb-8 ${
          compact ? "text-base md:text-lg" : "text-lg md:text-xl"
        }`}
      >
        Pegá la URL de un rival. Te mostramos qué hace mejor en Google — y qué cambiar hoy en la tuya.
        Sin Semrush. Sin informe de 50 páginas.
      </p>

      <div className="relative w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-3 duration-700 delay-150">
        <SpyUrlForm playClick={playClick} size="lg" autoFocus={!compact} />
        <p className="text-slate-500 text-sm font-bold mt-4">
          Gratis para empezar · 3 URLs en el plan free
        </p>
      </div>

      {onHow && (
        <a
          href="#como-funciona"
          onClick={onHow}
          className="relative mt-6 text-slate-400 hover:text-white font-bold underline underline-offset-4 decoration-slate-600 transition-colors text-sm"
        >
          ▶ Cómo funciona
        </a>
      )}
    </section>
  );
}

/**
 * Cajón de URL → GET /comenzar?spy=1&url=…
 * Funciona sin JS (form nativo). Con JS solo suma el sonido de click.
 */
function SpyUrlForm({ playClick, size = "lg", autoFocus = false }) {
  const isLg = size === "lg";
  return (
    <form
      action="/comenzar"
      method="GET"
      onSubmit={() => playClick && playClick()}
      className={`flex flex-col sm:flex-row gap-3 w-full ${isLg ? "" : ""}`}
    >
      <input type="hidden" name="spy" value="1" />
      <input
        type="text"
        name="url"
        inputMode="url"
        autoFocus={autoFocus}
        required
        placeholder="https://competidor.com/producto"
        aria-label="URL del competidor a espiar"
        className={`flex-1 rounded-2xl bg-slate-950 border-2 border-red-500/35 focus:border-red-400 text-white placeholder-slate-500 font-bold outline-none transition-colors ${
          isLg ? "px-5 py-4 text-base md:text-lg" : "px-4 py-3.5 text-sm md:text-base"
        }`}
      />
      <button
        type="submit"
        className={`btn-3d btn-green whitespace-nowrap transform hover:scale-105 transition-transform ${
          isLg ? "text-lg md:text-xl px-8 py-4" : "text-base px-6 py-3.5"
        }`}
      >
        🕵️ Espiar gratis
      </button>
    </form>
  );
}

function HowSpyWorks() {
  const steps = [
    {
      n: "1",
      title: "Pegás la URL del rival",
      desc: "Home, categoría o ficha: la página que te interesa ganar.",
    },
    {
      n: "2",
      title: "Comparamos con la tuya",
      desc: "Título, H1, temas, FAQ y Schema — en castellano, sin dashboard eterno.",
    },
    {
      n: "3",
      title: "Te decimos qué cambiar hoy",
      desc: "Cada brecha se vuelve una misión concreta que verificamos en vivo.",
    },
  ];
  return (
    <section className="w-full px-4 pb-8 md:pb-12">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-left relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="absolute -top-5 -right-3 text-6xl font-black text-red-500/10 select-none" aria-hidden>
              {s.n}
            </div>
            <div className="w-9 h-9 bg-red-500 text-white rounded-full flex items-center justify-center font-black text-lg shadow-lg border-2 border-red-400 mb-3">
              {s.n}
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5 relative z-10">{s.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed relative z-10">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BridgeCard({ n, title, desc }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="w-8 h-8 rounded-full bg-duo-green/20 border border-duo-green/40 text-duo-green font-black flex items-center justify-center mb-3 text-sm">
        {n}
      </div>
      <h3 className="font-black text-white text-lg mb-1">{title}</h3>
      <p className="text-slate-400 text-sm font-medium leading-relaxed">{desc}</p>
    </div>
  );
}

function Testimonial({ quote, author }) {
  return (
    <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
      <div className="text-yellow-400 text-sm mb-3" aria-hidden>
        ⭐⭐⭐⭐⭐
      </div>
      <p className="text-slate-300 italic mb-4 leading-relaxed">&ldquo;{quote}&rdquo;</p>
      <p className="font-bold text-white text-sm">— {author}</p>
    </div>
  );
}

function Faq({ q, a }) {
  return (
    <div className="bg-slate-900/80 p-5 md:p-6 rounded-2xl border border-slate-800">
      <h3 className="text-base md:text-lg font-bold text-white mb-2">{q}</h3>
      <p className="text-slate-400 text-sm md:text-base leading-relaxed">{a}</p>
    </div>
  );
}

function LandingFooter({ playClick }) {
  return (
    <footer className="w-full border-t border-slate-800 py-8 text-center text-slate-500 text-sm">
      <p>© {new Date().getFullYear()} SEO Jump. Todos los derechos reservados.</p>
      <div className="flex flex-wrap gap-4 justify-center mt-4">
        <Link href="/precios" onClick={playClick} className="hover:text-slate-300 transition-colors">
          Precios
        </Link>
        <Link href="/blog" onClick={playClick} className="hover:text-slate-300 transition-colors">
          Academia SEO
        </Link>
        <Link href="/espia-competencia" onClick={playClick} className="hover:text-slate-300 transition-colors">
          Espía de la Competencia
        </Link>
        <a href="/terminos" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
          Términos
        </a>
        <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
          Privacidad
        </a>
        <a href="mailto:nahuel@seo-jump.ai" className="hover:text-slate-300 transition-colors">
          Contacto
        </a>
      </div>
    </footer>
  );
}
