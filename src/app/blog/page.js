import Link from "next/link";
import { getAllPosts } from "../../lib/blog";

export const metadata = {
  title: "Blog de SEOJUMP | Estrategia SEO y Misiones para Posicionar tu Web",
  description: "Aprende posicionamiento en buscadores, SEO on-page y semántico de forma interactiva y sin tecnicismos con nuestros artículos guías.",
};

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-6 overflow-y-auto animate-in slide-in-from-bottom duration-500 w-full max-w-4xl mx-auto space-y-8 bg-[#f7f7f7] dark:bg-slate-900 transition-colors duration-300 text-slate-800 dark:text-slate-100 min-h-screen relative">
      
      {/* Navigation Header */}
      <header className="w-full flex flex-col gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border-2 border-duo-white-shadow dark:border-slate-700 transition-colors duration-300">
         <div className="flex items-center justify-between">
           <Link 
             href="/"
             className="text-slate-500 text-base md:text-lg font-black hover:text-slate-800 dark:hover:text-white flex items-center gap-2"
           >
             ← VOLVER AL DASHBOARD
           </Link>
           <div className="flex items-center gap-2">
             <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 text-xs font-black uppercase tracking-widest rounded-full px-3 py-1">
               🦉 Academia SEO
             </span>
           </div>
         </div>
      </header>

      {/* Main Title */}
      <div className="text-center space-y-3 py-4">
        <div className="text-5xl animate-bounce">📚</div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-slate-100">
          Academia de Misiones SEO
        </h1>
        <p className="text-base md:text-lg font-bold text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Guías prácticas e interactivas creadas por el Búho para que aprendas a posicionar tu negocio en Google en tus ratos libres.
        </p>
      </div>

      {/* Blog Cards Grid */}
      {posts.length > 0 ? (
        <main className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
          {posts.map((post) => (
            <article 
              key={post.slug}
              className="card-3d bg-white dark:bg-slate-850 p-6 rounded-2xl border-2 border-duo-white-shadow dark:border-slate-700/80 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group"
            >
              <div className="space-y-4">
                {/* Meta details */}
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
                  <time dateTime={post.date}>{post.date}</time>
                  <span>⏱️ {post.readTime}</span>
                </div>

                {/* Title */}
                <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white group-hover:text-duo-blue dark:group-hover:text-cyan-400 transition-colors leading-tight">
                  <Link href={`/blog/${post.slug}`}>
                    {post.title}
                  </Link>
                </h2>

                {/* Description */}
                <p className="text-slate-600 dark:text-slate-300 font-semibold text-sm md:text-base leading-relaxed">
                  {post.description}
                </p>
              </div>

              {/* Action Button */}
              <div className="pt-6">
                <Link 
                  href={`/blog/${post.slug}`}
                  className="btn-3d btn-blue w-full text-center py-3 font-black text-sm md:text-base block uppercase tracking-wider"
                >
                  Leer Misión →
                </Link>
              </div>
            </article>
          ))}
        </main>
      ) : (
        <div className="text-center py-16 px-6 card-3d bg-white/50 dark:bg-slate-800/50 border-dashed border-2 border-slate-200 dark:border-slate-700 shadow-none rounded-2xl w-full">
          <div className="text-6xl mb-4">🌵</div>
          <p className="text-slate-500 dark:text-slate-400 font-black text-xl">Aún no se han escrito artículos.</p>
          <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">Vuelve pronto para comenzar nuevas lecturas.</p>
        </div>
      )}

    </div>
  );
}
