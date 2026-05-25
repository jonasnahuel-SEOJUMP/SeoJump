import Link from "next/link";
import { getPostBySlug, getAllPosts, renderMarkdown } from "../../../lib/blog";

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  
  if (!post) {
    return {
      title: "Artículo No Encontrado | SEOJUMP",
      description: "El artículo solicitado no existe o fue movido."
    };
  }
  
  return {
    title: `${post.title} | Academia SEOJUMP`,
    description: post.description,
  };
}

export default async function BlogPost({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  
  if (!post) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-screen bg-[#07070d] text-slate-100">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">🔍</div>
          <h1 className="text-2xl font-black">Artículo no encontrado</h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold">La misión o artículo que estás buscando no existe o fue movido.</p>
          <Link href="/blog" className="btn-3d btn-blue py-3 px-6 inline-block font-black uppercase text-sm mt-4">
            Volver al Blog
          </Link>
        </div>
      </div>
    );
  }

  const htmlContent = renderMarkdown(post.content);

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-6 overflow-y-auto animate-in slide-in-from-bottom duration-500 w-full max-w-3xl mx-auto space-y-8 bg-transparent transition-colors duration-300 text-slate-100 min-h-screen relative">
      
      {/* Navigation Header */}
      <header className="w-full flex items-center justify-between bg-white dark:bg-slate-800 p-5 rounded-2xl border-2 border-duo-white-shadow dark:border-slate-700 transition-colors duration-300">
         <Link 
           href="/blog"
           className="text-slate-500 text-base md:text-lg font-black hover:text-slate-800 dark:hover:text-white flex items-center gap-2"
         >
           ← VOLVER AL BLOG
         </Link>
         <span className="text-xs font-black bg-duo-blue/10 border border-duo-blue/20 text-duo-blue dark:text-cyan-400 rounded-full px-3 py-1 uppercase tracking-wide">
           📖 {post.readTime}
         </span>
      </header>

      {/* Main Post Article */}
      <article className="w-full bg-slate-800 border-2 border-slate-700/80 p-6 md:p-10 rounded-3xl text-white shadow-sm space-y-6">
        
        {/* Post Metadata Header */}
        <header className="space-y-4 border-b border-slate-700 pb-6">
          <div className="flex items-center gap-3 text-xs md:text-sm font-bold text-slate-400">
            <time dateTime={post.date}>{post.date}</time>
            <span>•</span>
            <span>Por {post.author}</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
            {post.title}
          </h1>
          
          <p className="text-lg md:text-xl font-bold text-slate-300 leading-relaxed italic">
            "{post.description}"
          </p>
        </header>

        {/* Rendered markdown content */}
        <section 
          className="prose prose-invert max-w-none space-y-4"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
        
        {/* Post Footer Call to Action */}
        <footer className="border-t border-slate-700 pt-8 mt-10 text-center space-y-4">
          <div className="text-4xl">🦉</div>
          <h3 className="text-xl font-black text-white">¿Entendiste la lección, jugador?</h3>
          <p className="text-sm md:text-base font-bold text-slate-400 max-w-md mx-auto leading-relaxed">
            Poné en práctica estos conocimientos en tu panel del buscador para detectar oportunidades reales y sumarle XP a tu web.
          </p>
          <div className="pt-4">
            <Link 
              href="/"
              className="btn-3d btn-green py-3 px-8 font-black uppercase text-sm md:text-base tracking-wider inline-block"
            >
              Ir a las Misiones →
            </Link>
          </div>
        </footer>

      </article>

    </div>
  );
}
