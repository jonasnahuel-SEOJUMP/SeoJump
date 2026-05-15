"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("Iniciando análisis...");
  
  // Mission 1 State
  const [h1Value, setH1Value] = useState("");
  const [missionStatus, setMissionStatus] = useState("idle"); // idle, checking, success
  const [xp, setXp] = useState(50);
  const [showConfetti, setShowConfetti] = useState(false);

  // Handle Scanning Animation
  useEffect(() => {
    if (step === 4) {
      const messages = [
        "Iniciando análisis...",
        "Revisando etiquetas H1...",
        "Analizando velocidad de carga...",
        "Buscando palabras clave...",
        "Detectando errores técnicos...",
        "¡Análisis completado!"
      ];
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += 2;
        setScanProgress(progress);
        
        const msgIndex = Math.min(Math.floor((progress / 100) * messages.length), messages.length - 1);
        setScanMessage(messages[msgIndex]);

        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => setStep(5), 1000);
        }
      }, 50);
      
      return () => clearInterval(interval);
    }
  }, [step]);

  const checkMission = () => {
    setMissionStatus("checking");
    setTimeout(() => {
      if (h1Value.length > 5 && h1Value.length < 60) {
        setMissionStatus("success");
        setXp(100);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      } else {
        setMissionStatus("error");
      }
    }, 1500);
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  return (
    <div className="min-h-screen bg-[#f7f7f7] flex flex-col items-center p-8 font-fredoka relative overflow-hidden">
      
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="absolute animate-bounce text-2xl"
              style={{ 
                left: `${Math.random() * 100}%`, 
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random()}s`
              }}
            >
              {['✨', '🎉', '💎', '⭐', '🎈'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      <main className="max-w-md w-full py-12 flex flex-col items-center">
        
        {/* Progress Bar (at the top) */}
        {step > 1 && step < 5 && (
          <div className="w-full h-4 bg-gray-200 rounded-full mb-12 border-2 border-gray-200">
            <div 
              className="h-full bg-duo-green rounded-full transition-all duration-300" 
              style={{ width: `${(step / 4) * 100}%` }}
            ></div>
          </div>
        )}

        {/* STEP 1-5 same as before... */}
        {step === 1 && (
          <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="text-8xl mb-4">🚀</div>
            <h1 className="text-4xl font-black text-duo-green tracking-tight">
              SEOJUMP
            </h1>
            <p className="text-2xl font-bold text-gray-500">
              ¡Domina el SEO como si fuera un juego!
            </p>
            <div className="pt-8">
              <button onClick={nextStep} className="btn-3d btn-green text-2xl px-12">
                EMPEZAR
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="w-full space-y-8 animate-in slide-in-from-right duration-300">
            <h2 className="text-3xl font-black text-gray-700 text-center">
              ¿Cuál es tu sitio web?
            </h2>
            <div className="card-3d bg-white">
              <input 
                type="text" 
                placeholder="ej: miweb.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full p-4 text-xl border-2 border-gray-200 rounded-xl focus:border-duo-blue outline-none transition-colors font-bold text-gray-600"
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={nextStep} 
                disabled={!url}
                className={`btn-3d btn-blue text-xl ${!url ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              >
                CONTINUAR
              </button>
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300"></span></div>
                <div className="relative flex justify-center text-sm uppercase"><span className="bg-[#f7f7f7] px-2 text-gray-400 font-bold">O también</span></div>
              </div>

              <button 
                onClick={() => { setUrl("seojump-demo.com"); setStep(3); }} 
                className="btn-3d btn-white text-xl border-dashed border-2"
              >
                🎮 USAR MODO DEMO
              </button>

              <button onClick={prevStep} className="text-gray-400 font-bold hover:text-gray-600 transition-colors">
                VOLVER ATRÁS
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="w-full space-y-8 animate-in slide-in-from-right duration-300">
            <h2 className="text-3xl font-black text-gray-700 text-center">
              ¿Cuál es tu objetivo?
            </h2>
            <div className="space-y-4">
              {[
                { id: 'vender', label: '💰 Vender más', color: 'btn-yellow' },
                { id: 'visitas', label: '📈 Conseguir más visitas', color: 'btn-blue' },
                { id: 'local', label: '📍 Ser el #1 en mi ciudad', color: 'btn-green' }
              ].map((option) => (
                <button 
                  key={option.id}
                  onClick={() => setGoal(option.id)}
                  className={`btn-3d w-full text-xl py-5 ${goal === option.id ? option.color : 'btn-white text-gray-500'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={nextStep} 
                disabled={!goal}
                className={`btn-3d btn-green text-xl ${!goal ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              >
                ANALIZAR SITIO
              </button>
              <button onClick={prevStep} className="btn-3d btn-white text-xl">
                VOLVER
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="w-full text-center space-y-12 py-12 animate-in zoom-in duration-500">
            <div className="relative w-48 h-48 mx-auto">
              <div className="absolute inset-0 rounded-full border-8 border-gray-100"></div>
              <div 
                className="absolute inset-0 rounded-full border-8 border-duo-blue border-t-transparent animate-spin"
                style={{ animationDuration: '1s' }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center text-4xl">
                🔍
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-gray-700">
                Escaneando...
              </h2>
              <p className="text-xl font-bold text-duo-blue animate-pulse">
                {scanMessage}
              </p>
              <div className="w-full h-6 bg-gray-200 rounded-full border-2 border-gray-200 overflow-hidden">
                <div 
                  className="h-full bg-duo-blue transition-all duration-75"
                  style={{ width: `${scanProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="w-full text-center space-y-8 animate-in fade-in duration-500">
             <div className="text-8xl">✨</div>
             <h2 className="text-4xl font-black text-duo-green">¡Todo listo!</h2>
             <div className="card-3d text-left">
                <p className="text-xl font-bold text-gray-600 mb-4">
                  Hemos analizado <span className="text-duo-blue">{url}</span>.
                </p>
                <p className="text-gray-500 font-bold italic">
                  "Tu sitio tiene potencial, pero faltan algunos detalles técnicos para llegar a la cima."
                </p>
             </div>
             <button onClick={() => setStep(6)} className="btn-3d btn-green text-2xl w-full">
                VER MI DASHBOARD
             </button>
          </div>
        )}

        {step === 6 && (
          <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-bottom duration-500">
            {/* Dashboard Header */}
            <header className="w-full flex items-center justify-between bg-white p-4 rounded-2xl border-2 border-duo-white-shadow sticky top-4 z-10">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-duo-blue rounded-lg flex items-center justify-center text-white text-xl">🌐</div>
                  <span className="font-black text-gray-600 truncate max-w-[150px]">{url}</span>
               </div>
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                     <span className="text-2xl">🔥</span>
                     <span className="font-black text-orange-500">3</span>
                  </div>
                  <div className="w-10 h-10 bg-duo-green rounded-full flex items-center justify-center border-b-4 border-duo-green-shadow text-white">
                     👤
                  </div>
               </div>
            </header>

            {/* Level & XP Stats */}
            <div className="card-3d bg-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl font-black text-duo-yellow">NIVEL 1</span>
                <span className="text-sm font-bold text-gray-400">{xp} / 100 XP</span>
              </div>
              <div className="w-full h-6 bg-gray-100 rounded-full border-2 border-gray-100 overflow-hidden">
                <div 
                  className="h-full bg-duo-yellow transition-all duration-1000"
                  style={{ width: `${xp}%` }}
                ></div>
              </div>
            </div>

            {/* Daily Missions */}
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-gray-700">Misiones de hoy</h2>
              
              <div className="space-y-4">
                {/* Mission 1 */}
                <div 
                   onClick={() => setStep(7)}
                   className="card-3d flex items-start gap-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-duo-green rounded-2xl flex-shrink-0 flex items-center justify-center border-b-4 border-duo-green-shadow text-3xl">
                    {xp >= 100 ? '✅' : 'H1'}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-gray-700 group-hover:text-duo-green transition-colors">El Guardián del Título</h3>
                    <p className="font-bold text-gray-400">Optimiza tu etiqueta H1 principal.</p>
                    <div className="mt-3">
                      <button className={`btn-3d ${xp >= 100 ? 'btn-white' : 'btn-green'} text-sm py-2 px-4`}> 
                        {xp >= 100 ? 'COMPLETADA' : 'EMPEZAR (+50 XP)'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Other missions same as before... */}
                <div className="card-3d flex items-start gap-4 opacity-70 grayscale">
                  <div className="w-16 h-16 bg-duo-blue rounded-2xl flex-shrink-0 flex items-center justify-center border-b-4 border-duo-blue-shadow text-3xl">🖼️</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-gray-700">Ojos de Google</h3>
                    <p className="font-bold text-gray-400">Añade texto ALT a tus imágenes.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center pt-8">
              <button onClick={() => {setStep(1); setXp(50);}} className="text-gray-400 font-bold hover:text-red-500 transition-colors">
                REINICIAR DEMO
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: MISSION MODAL */}
        {step === 7 && (
          <div className="w-full space-y-8 animate-in zoom-in duration-300">
            {/* Mission Header */}
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setStep(6)} className="text-4xl text-gray-400 hover:text-gray-600">✕</button>
              <h2 className="text-2xl font-black text-gray-700">Misión: H1</h2>
            </div>

            {/* Character Guide */}
            <div className="flex items-start gap-6 bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm relative">
               <div className="text-6xl animate-bounce flex-shrink-0">🦉</div>
               <div className="flex-1 space-y-3">
                  <div className="bg-duo-blue text-white p-4 rounded-2xl rounded-tl-none font-bold relative text-sm sm:text-base leading-relaxed">
                    {missionStatus === "idle" && (
                      <>
                        <p className="mb-2">¡Hola! Imagina que tu H1 es el **cartel principal de un local** en la calle. 🏪</p>
                        <p>Si el cartel no dice qué vendes, la gente (y Google) pasará de largo. Google usa este título para decidir si tu página responde a lo que la gente busca.</p>
                      </>
                    )}
                    {missionStatus === "checking" && "Mmm... déjame revisar tu cartel... 🤔"}
                    {missionStatus === "error" && (
                      <p>Tu cartel está un poco borroso. Probá incluyendo tu palabra clave principal para que Google te encuentre más rápido.</p>
                    )}
                    {missionStatus === "success" && (
                      <p>¡Título optimizado! Ahora Google sabe exactamente de qué trata tu web. ✨</p>
                    )}
                    
                    {/* Speech bubble arrow */}
                    <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-duo-blue border-l-[10px] border-l-transparent"></div>
                  </div>
               </div>
            </div>

            {/* Mission Content */}
            <div className="card-3d bg-white space-y-6">
              <p className="font-bold text-gray-500">
                ¿Qué dice el cartel principal de <span className="text-duo-blue">{url}</span>?
              </p>

              <input 
                type="text"
                placeholder="ej: Los Mejores Zapatos de Cuero"
                value={h1Value}
                onChange={(e) => setH1Value(e.target.value)}
                className="w-full p-4 text-xl border-2 border-gray-200 rounded-xl focus:border-duo-green outline-none font-bold text-gray-600"
              />
              
              <button 
                onClick={checkMission}
                disabled={missionStatus === "checking" || missionStatus === "success"}
                className={`btn-3d w-full text-xl ${missionStatus === "success" ? "btn-green" : "btn-blue"}`}
              >
                {missionStatus === "idle" && "VERIFICAR MISION"}
                {missionStatus === "checking" && "VERIFICANDO..."}
                {missionStatus === "error" && "REINTENTAR"}
                {missionStatus === "success" && "¡MISIÓN COMPLETADA!"}
              </button>
            </div>

            {missionStatus === "success" && (
              <button 
                onClick={() => setStep(6)} 
                className="btn-3d btn-green w-full text-xl"
              >
                VOLVER AL DASHBOARD
              </button>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
