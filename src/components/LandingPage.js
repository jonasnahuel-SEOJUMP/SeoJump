import React from "react";

export default function LandingPage({ onStart, playClick }) {
  const handleStart = () => {
    if (playClick) playClick();
    onStart();
  };

  return (
    <div className="w-full text-slate-100 font-fredoka flex flex-col items-center max-w-7xl mx-auto animate-in fade-in zoom-in duration-500">
      
      {/* BARRA DE ANUNCIO SUPERIOR */}
      <div className="w-full bg-gradient-to-r from-duo-green to-teal-500 text-slate-900 font-bold text-center py-2 px-4 rounded-b-xl shadow-lg mb-8 text-sm md:text-base animate-pulse">
        ✨ Nuevo módulo AEO: Detectá oportunidades ocultas en tu web para aparecer en las respuestas de ChatGPT, Gemini y Google AI.
      </div>

      {/* SECCIÓN 1: HERO */}
      <section className="w-full flex flex-col items-center text-center py-12 md:py-20 px-4">
        <span className="px-4 py-1.5 bg-duo-green/20 border border-duo-green/40 rounded-full text-duo-green text-xs md:text-sm font-black uppercase tracking-widest mb-6">
          LA PRIMERA PLATAFORMA GAMIFICADA DE VISIBILIDAD WEB
        </span>
        <img src="/images/logo-full.png" alt="SEO Jump" className="w-48 md:w-64 h-auto object-contain mb-6 drop-shadow-2xl" />
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.1] max-w-4xl mb-6">
          Convertí tu web en una máquina de atraer <span className="text-duo-green">clientes reales.</span>
        </h1>
        <p className="text-slate-300 font-semibold text-lg md:text-2xl leading-relaxed max-w-3xl mb-10">
          SEO Jump se conecta a tu sitio, detecta las oportunidades de tráfico que hoy tenés ocultas en Google y te dice exactamente cómo optimizar tu contenido para convertirte en la respuesta que recomiendan <strong className="text-purple-400">ChatGPT, Gemini</strong> y las nuevas búsquedas con Inteligencia Artificial. <br/><span className="text-slate-400">Sin tecnicismos. Sin informes aburridos.</span>
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <button 
            onClick={handleStart}
            className="btn-3d btn-green text-xl md:text-2xl px-8 py-5 w-full sm:w-auto transform hover:scale-105 transition-all"
          >
            🚀 Analizar Mi Web Gratis
          </button>
          <a href="#" className="text-slate-400 hover:text-white font-bold underline underline-offset-4 decoration-slate-600 transition-colors py-4">
            ▶ Ver cómo funciona
          </a>
        </div>
        
        <div className="mt-8 flex flex-col items-center">
          <div className="flex text-yellow-400 text-xl mb-2">⭐⭐⭐⭐⭐</div>
          <p className="text-slate-400 text-sm font-medium max-w-xl">
            <strong className="text-slate-300">4.9/5</strong> – Utilizado por negocios locales, e-commerce y agencias que quieren crecer rápido sin depender de auditorías eternas ni herramientas complejas.
          </p>
        </div>
      </section>

      {/* SECCIÓN 2: EL PROBLEMA */}
      <section className="w-full py-16 px-4">
        <div className="bg-slate-900 p-8 md:p-12 rounded-3xl border-2 border-slate-700 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500 opacity-5 rounded-full blur-3xl pointer-events-none"></div>
          
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6 text-center md:text-left">
            Tu sitio web está perdiendo clientes en este preciso segundo. Y no lo sabés.
          </h2>
          <p className="text-slate-300 text-lg mb-10 max-w-4xl text-center md:text-left">
            Cada día, miles de personas entran a Google, ChatGPT o Gemini buscando exactamente los productos o servicios que vos vendés. El problema no es tu producto; es que tu web es invisible para los algoritmos.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border border-red-500/30">❌</div>
              <div>
                <h3 className="text-lg font-black text-red-400">El potencial enterrado</h3>
                <p className="text-slate-300 text-base mt-1.5">Tenés páginas en tu web que están a un paso de llegar al Top 3 de Google, pero mueren en la página 2 porque nadie te dice qué pequeño cambio aplicar.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border border-red-500/30">❌</div>
              <div>
                <h3 className="text-lg font-black text-red-400">El misterio de las Keywords</h3>
                <p className="text-slate-300 text-base mt-1.5">Tus competidores están absorbiendo el tráfico de palabras clave que están cerca de explotar en tu sector, simplemente porque ellos tienen los datos y vos no.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border border-red-500/30">❌</div>
              <div>
                <h3 className="text-lg font-black text-red-400">El punto ciego de la IA (AEO)</h3>
                <p className="text-slate-300 text-base mt-1.5">Las Inteligencias Artificiales ya están respondiendo las dudas de tus clientes. Si tu contenido no está estructurado para ellas, tu competencia se queda con la recomendación.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border border-red-500/30">❌</div>
              <div>
                <h3 className="text-lg font-black text-red-400">Parálisis por análisis</h3>
                <p className="text-slate-300 text-base mt-1.5">Herramientas como Search Console te inundan de gráficos y métricas confusas, pero te dejan con la misma duda: ¿Qué tengo que hacer hoy?</p>
              </div>
            </div>
          </div>
          <div className="mt-10 p-6 bg-duo-green/10 border border-duo-green/30 rounded-2xl text-center">
            <p className="text-xl font-bold text-duo-green">La Solución: SEO Jump barre el desorden técnico y encuentra esas oportunidades por vos de forma automática.</p>
          </div>
        </div>
      </section>

      {/* SECCIÓN 3: CÓMO FUNCIONA */}
      <section className="w-full py-16 px-4 flex flex-col items-center text-center">
        <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
          De datos complejos a acciones simples en 3 clics.
        </h2>
        <p className="text-slate-300 text-lg md:text-xl max-w-2xl mb-12">
          No necesitás un máster en analítica web. El proceso está diseñado para personas que valoran su tiempo.
        </p>

        <div className="flex flex-col lg:flex-row items-center gap-12 w-full max-w-6xl">
          <div className="flex-1 w-full relative">
            <div className="absolute inset-0 bg-duo-blue/20 blur-3xl rounded-full"></div>
            <div className="relative bg-slate-800 border-2 border-slate-700 rounded-2xl shadow-2xl overflow-hidden aspect-[4/3] flex items-center justify-center">
              <span className="text-slate-500 font-bold">[Aquí irá un Mockup / Screenshot de la App]</span>
            </div>
          </div>
          
          <div className="flex-1 space-y-8 text-left w-full">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-duo-blue text-white rounded-full flex items-center justify-center font-black shrink-0 text-xl shadow-lg border-2 border-blue-400">1</div>
              <div>
                <h3 className="text-xl font-bold text-white">Conectás tu Search Console</h3>
                <p className="text-slate-400 mt-2">En 10 segundos, de forma 100% segura y con un solo clic a través de tu cuenta de Google.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-duo-purple text-white bg-purple-600 rounded-full flex items-center justify-center font-black shrink-0 text-xl shadow-lg border-2 border-purple-400">2</div>
              <div>
                <h3 className="text-xl font-bold text-white">Nuestra IA procesa los datos</h3>
                <p className="text-slate-400 mt-2">Escaneamos tu sitio buscando anomalías, intenciones de búsqueda y palabras clave con alta probabilidad de conversión.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-duo-green text-white rounded-full flex items-center justify-center font-black shrink-0 text-xl shadow-lg border-2 border-green-400">3</div>
              <div>
                <h3 className="text-xl font-bold text-white">Ejecutás tus Oportunidades</h3>
                <p className="text-slate-400 mt-2">El sistema te sirve en bandeja una lista de misiones diarias simples. Aplicás el cambio, sumás XP y ves subir tu tráfico.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 4: BENEFICIOS DETALLADOS */}
      <section className="w-full py-16 px-4">
        <h2 className="text-3xl md:text-5xl font-black text-center text-white mb-12">
          Todo el poder de una agencia de SEO en un panel gamificado.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-orange-500/50 transition-colors">
            <div className="text-4xl mb-4">🔎</div>
            <h3 className="text-xl font-bold text-white mb-3">Oportunidades SEO (Quick Wins)</h3>
            <p className="text-slate-400 leading-relaxed">Identificá de forma inmediata qué páginas y palabras clave están listas para dar un salto en el ranking de Google. Te damos el insight masticado: solo tenés que aplicar la recomendación.</p>
          </div>
          <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-purple-500/50 transition-colors">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-white mb-3">Oportunidades AEO</h3>
            <p className="text-slate-400 leading-relaxed">Asegurá el futuro de tu negocio. Detectamos qué contenidos tienen el potencial técnico para convertirse en las fuentes citadas por ChatGPT, Gemini y Google AI Overviews.</p>
          </div>
          <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-yellow-500/50 transition-colors">
            <div className="text-4xl mb-4">🎮</div>
            <h3 className="text-xl font-bold text-white mb-3">Misiones Inteligentes</h3>
            <p className="text-slate-400 leading-relaxed">Transformamos el aburrido trabajo de optimización web en un juego de estrategia. Cada tarea es una misión clara. Completás la misión, mejoras tu web y sumás puntos de experiencia.</p>
          </div>
          <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-cyan-500/50 transition-colors">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-xl font-bold text-white mb-3">Score de Visibilidad</h3>
            <p className="text-slate-400 leading-relaxed">Un indicador en tiempo real que mide la salud de tu posicionamiento y tu optimización para IA. Tu Score te dice de un vistazo si estás ganando autoridad.</p>
          </div>
        </div>
      </section>

      {/* SECCIÓN 5: ENFOQUE ESTRATÉGICO (AEO) */}
      <section className="w-full py-20 px-4">
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-8 md:p-14 rounded-3xl border border-purple-500/30 shadow-[0_0_50px_rgba(139,92,246,0.15)] text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20"></div>
          
          <h2 className="text-3xl md:text-5xl font-black text-white mb-8 relative z-10">
            El futuro de internet no es solo aparecer. Es <span className="text-purple-300">convertirse en la respuesta.</span>
          </h2>
          <p className="text-purple-100 text-lg md:text-xl max-w-4xl mx-auto leading-relaxed relative z-10 font-medium">
            El SEO tradicional está cambiando para siempre. Antes, una persona buscaba en Google, miraba diez enlaces y elegía uno. Hoy, millones de usuarios le preguntan directamente a una Inteligencia Artificial y reciben una única respuesta armada.
            <br/><br/>
            Si un potencial cliente le pregunta a ChatGPT: <em>«¿Cuál es el mejor servicio en mi zona?»</em>, la IA va a citar a las webs que demuestren mayor claridad y autoridad temática. SEO Jump analiza tu contenido y te da las pautas exactas para que las IA te elijan a vos. <br/><br/><strong>Estar presente donde la gente busca respuestas ya no es opcional, es supervivencia comercial.</strong>
          </p>
        </div>
      </section>

      {/* SECCIÓN 6: LA GAMIFICACIÓN */}
      <section className="w-full py-16 px-4 flex flex-col items-center">
        <h2 className="text-3xl md:text-5xl font-black text-center text-white mb-4">
          Olvidate de los tableros imposibles. Esto es un juego.
        </h2>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl text-center mb-12">
          Convertimos las tareas complejas que las agencias te cobran una fortuna por reportar, en misiones diarias que podés resolver en tus 15 minutos libres del día.
        </p>

        <div className="flex flex-col gap-4 w-full max-w-3xl">
          <div className="bg-slate-800 border-2 border-slate-700 rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-500/20 text-yellow-500 rounded-lg flex items-center justify-center text-2xl border border-yellow-500/30">🏆</div>
              <div>
                <h4 className="font-bold text-white text-lg">Captura de Tráfico Corto</h4>
                <p className="text-slate-400 text-sm">Subí el CTR de tu página de servicios optimizando el título oculto.</p>
              </div>
            </div>
            <div className="bg-slate-900 px-3 py-1.5 rounded-full border border-slate-700 text-yellow-500 font-black text-sm whitespace-nowrap">
              +20 XP
            </div>
          </div>

          <div className="bg-slate-800 border-2 border-slate-700 rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-lg flex items-center justify-center text-2xl border border-purple-500/30">🤖</div>
              <div>
                <h4 className="font-bold text-white text-lg">Blindaje contra IA</h4>
                <p className="text-slate-400 text-sm">Estructurá este artículo en formato de respuesta directa para ser citado por Gemini.</p>
              </div>
            </div>
            <div className="bg-slate-900 px-3 py-1.5 rounded-full border border-slate-700 text-yellow-500 font-black text-sm whitespace-nowrap">
              +30 XP
            </div>
          </div>

          <div className="bg-slate-800 border-2 border-slate-700 rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500/20 text-red-500 rounded-lg flex items-center justify-center text-2xl border border-red-500/30">⚔️</div>
              <div>
                <h4 className="font-bold text-white text-lg">Ataque a la Competencia</h4>
                <p className="text-slate-400 text-sm">Aprovechá esta keyword de oportunidad antes de que tu competidor principal la note.</p>
              </div>
            </div>
            <div className="bg-slate-900 px-3 py-1.5 rounded-full border border-slate-700 text-yellow-500 font-black text-sm whitespace-nowrap">
              +25 XP
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 7: PARA QUIÉN ES */}
      <section className="w-full py-16 px-4">
        <h2 className="text-3xl md:text-5xl font-black text-center text-white mb-12">
          Creado para quienes necesitan resultados, no reportes.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="bg-slate-900 p-6 rounded-2xl border-l-4 border-l-blue-500 border border-slate-800">
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">📍 Negocios Locales & PyMEs</h3>
            <p className="text-slate-400">Atraé clientes calificados de tu ciudad que están listos para comprar, optimizando las páginas clave de tu web sin tocar una sola línea de código.</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border-l-4 border-l-orange-500 border border-slate-800">
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">📦 E-commerce</h3>
            <p className="text-slate-400">Detectá qué fichas de producto o categorías están perdiendo ventas por falta de optimización y dales el empujón definitivo hacia los primeros lugares.</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border-l-4 border-l-purple-500 border border-slate-800">
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">💼 Agencias & Marketers</h3>
            <p className="text-slate-400">Automatizá el análisis aburrido de tus clientes de Search Console. Descubrí oportunidades en segundos y presentá propuestas de valor inmediato.</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border-l-4 border-l-duo-green border border-slate-800">
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">✍ Creadores de Contenido</h3>
            <p className="text-slate-400">Asegurá que tus artículos no mueran en el olvido. Optimizalos para buscadores tradicionales y motores de respuesta de IA en minutos.</p>
          </div>
        </div>
      </section>

      {/* SECCIÓN 8: EL DIFERENCIAL */}
      <section className="w-full py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-10">
            La mayoría te inunda con datos. SEO Jump te da la oportunidad servida.
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-700 shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="bg-slate-800 p-4 md:p-6 text-slate-300 font-bold border-b border-slate-700 w-1/2">Otras plataformas (Semrush, Ahrefs)</th>
                  <th className="bg-duo-green/10 p-4 md:p-6 text-duo-green font-bold border-b border-duo-green/20 w-1/2">Lo que hace SEO Jump por vos</th>
                </tr>
              </thead>
              <tbody className="bg-slate-900">
                <tr>
                  <td className="p-4 md:p-6 border-b border-slate-800 text-slate-400 text-sm md:text-base">Te obligan a cruzar datos, interpretar gráficos de líneas y saber de SEO técnico.</td>
                  <td className="p-4 md:p-6 border-b border-slate-800 text-white font-medium text-sm md:text-base bg-duo-green/5">Te analiza los datos en segundo plano y te da la oportunidad ya procesada.</td>
                </tr>
                <tr>
                  <td className="p-4 md:p-6 border-b border-slate-800 text-slate-400 text-sm md:text-base">Te muestran números fríos de volumen de búsqueda y dificultad.</td>
                  <td className="p-4 md:p-6 border-b border-slate-800 text-white font-medium text-sm md:text-base bg-duo-green/5">Te dice exactamente qué hacer, por qué hacerlo y cuál va a ser el impacto.</td>
                </tr>
                <tr>
                  <td className="p-4 md:p-6 text-slate-400 text-sm md:text-base">Requieren horas de análisis aburrido o pagar cientos de dólares al mes en reportes.</td>
                  <td className="p-4 md:p-6 text-white font-medium text-sm md:text-base bg-duo-green/5">Te entrega misiones accionables listas para copiar, pegar y ejecutar en minutos.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECCIÓN 9: TESTIMONIALS */}
      <section className="w-full py-16 px-4">
        <h2 className="text-3xl md:text-4xl font-black text-center text-white mb-12">Lo que dicen los primeros "jugadores"</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
            <div className="text-yellow-400 text-sm mb-3">⭐⭐⭐⭐⭐</div>
            <p className="text-slate-300 italic mb-4">"Tenía pánico de entrar a Search Console porque no entendía nada. Con SEO Jump descubrí páginas a nada de entrar en primera página. Apliqué el cambio y el tráfico empezó a subir a la semana."</p>
            <p className="font-bold text-white text-sm">— Juan M., Tienda Online</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
            <div className="text-yellow-400 text-sm mb-3">⭐⭐⭐⭐⭐</div>
            <p className="text-slate-300 italic mb-4">"Como agencia, procesar los datos de diez clientes nos llevaba días. SEO Jump nos entrega los insights y las oportunidades AEO masticadas en segundos. Convierte nuestro tiempo libre en un motor de ventas."</p>
            <p className="font-bold text-white text-sm">— Elena R., Directora de Agencia</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
            <div className="text-yellow-400 text-sm mb-3">⭐⭐⭐⭐⭐</div>
            <p className="text-slate-300 italic mb-4">"La sección de Oportunidades AEO es una locura. Logramos que ChatGPT nos cite como referencia en dos de nuestros artículos principales de servicios. El retorno es inmediato."</p>
            <p className="font-bold text-white text-sm">— Carlos T., Consultor SEO</p>
          </div>
        </div>
      </section>

      {/* SECCIÓN 10: FAQ */}
      <section className="w-full py-16 px-4 max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black text-center text-white mb-10">Preguntas Frecuentes</h2>
        <div className="space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-2">¿Tengo que ser un experto en SEO para usar la plataforma?</h3>
            <p className="text-slate-400">Para nada. El software nació justamente para eliminar la necesidad de ser un experto. SEO Jump se encarga del análisis complejo y te traduce todo en instrucciones simples en español. Si sabés copiar, pegar y redactar un texto básico, sabés usar SEO Jump.</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-2">¿Por qué es obligatorio conectar Google Search Console?</h3>
            <p className="text-slate-400">Porque Search Console es la única fuente de verdad oficial de Google. Al conectarlo de forma segura, la IA del software puede leer el rendimiento real de tu web (sin adivinar) para encontrar las oportunidades exactas que pertenecen a tu negocio.</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-2">¿Qué diferencia hay entre SEO y AEO?</h3>
            <p className="text-slate-400">El SEO tradicional busca que tu página aparezca en la lista de enlaces azules de Google. El AEO (Answer Engine Optimization) busca que tu contenido esté tan bien optimizado que las IA (como ChatGPT o Gemini) lo elijan a él para armar la respuesta que le muestran al usuario. Ambos trabajan juntos en la app.</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-2">¿Es seguro conectar mi cuenta de Google?</h3>
            <p className="text-slate-400">Completamente. La conexión se realiza a través de la API oficial de Google utilizando el protocolo seguro de autenticación de ellos. No tenemos acceso a tus contraseñas y tus datos están protegidos.</p>
          </div>
        </div>
      </section>

      {/* SECCIÓN 11: CTA FINAL */}
      <section className="w-full py-20 px-4 mb-10">
        <div className="max-w-4xl mx-auto bg-slate-900 border-2 border-duo-green/30 p-10 md:p-16 rounded-3xl text-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-duo-green/5 blur-xl pointer-events-none"></div>
          <h3 className="text-2xl md:text-4xl font-black text-white mb-6 relative z-10">
            Tu próximo cliente ya está buscando una respuesta en internet.
          </h3>
          <p className="text-slate-300 text-lg md:text-xl mb-10 relative z-10">
            Cuando Google o ChatGPT respondan... ¿la respuesta va a ser tu negocio o el de tu competencia? No dejes dinero sobre la mesa. Convertí tu web en un activo que trabaje por vos 24/7.
          </p>
          <div className="relative z-10 w-full max-w-md mx-auto">
            <button 
              onClick={handleStart}
              className="btn-3d btn-green text-xl md:text-2xl px-6 py-5 w-full transform hover:scale-105 transition-all"
            >
              🚀 Empezar Gratis Ahora
            </button>
            <p className="text-slate-500 text-xs mt-6">
              Al registrarte aceptás nuestros <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Términos de Servicio</a> y <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Política de Privacidad</a>.
            </p>
          </div>
        </div>
      </section>

      <footer className="w-full border-t border-slate-800 py-8 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} SEO Jump. Todos los derechos reservados.</p>
        <div className="flex gap-4 justify-center mt-4">
          <a href="/terminos" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Términos y Condiciones</a>
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Política de Privacidad</a>
          <a href="mailto:soporte@seojump.com" className="hover:text-slate-300 transition-colors">Contacto</a>
        </div>
      </footer>

    </div>
  );
}
