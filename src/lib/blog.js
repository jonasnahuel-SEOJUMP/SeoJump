import fs from 'fs';
import path from 'path';

// Clean helper to decode WordPress common HTMl entities and UTF-8 patterns
const purifyText = (text) => {
  if (!text) return "";
  let clean = text;
  clean = clean
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;|\u2013|\u2014/g, "-")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"');
  return clean.trim();
};

export function getPostBySlug(slug) {
  const blogDir = path.join(process.cwd(), 'src', 'content', 'blog');
  const filePath = path.join(blogDir, `${slug}.md`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  // Custom simple yaml-frontmatter parser
  const match = fileContent.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
  
  if (!match) {
    return {
      slug,
      title: purifyText(slug.replace(/-/g, ' ')),
      description: "",
      date: new Date().toISOString().split('T')[0],
      readTime: "3 min",
      content: fileContent
    };
  }
  
  const yamlContent = match[1];
  const content = match[2];
  
  const metadata = {};
  yamlContent.split(/\r?\n/).forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      metadata[key] = purifyText(value);
    }
  });
  
  return {
    slug,
    content,
    title: metadata.title || purifyText(slug.replace(/-/g, ' ')),
    description: metadata.description || "",
    date: metadata.date || new Date().toISOString().split('T')[0],
    readTime: metadata.readTime || "3 min",
    image: metadata.image || null,
    author: metadata.author || "SeoJump"
  };
}

export function getAllPosts() {
  const blogDir = path.join(process.cwd(), 'src', 'content', 'blog');
  
  if (!fs.existsSync(blogDir)) {
    return [];
  }
  
  const files = fs.readdirSync(blogDir);
  return files
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const slug = file.replace(/\.md$/, '');
      return getPostBySlug(slug);
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Simple custom Markdown parser that produces static HTML with standard classes
export function renderMarkdown(markdown) {
  if (!markdown) return "";
  let html = markdown;

  // Escaping basic HTML to prevent injection
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Re-allow specific formatted headings (H1, H2, H3)
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg md:text-xl font-black text-white mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl md:text-2xl font-black text-duo-yellow mt-8 mb-4 border-b border-slate-700 pb-2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl md:text-3xl font-black text-white mt-10 mb-6">$1</h1>');

  // Bold (**text**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-extrabold">$1</strong>');
  
  // Italics (*text*)
  html = html.replace(/\*(.*?)\*/g, '<em class="italic text-slate-300">$1</em>');

  // Links ([text](url))
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-cyan-400 hover:underline font-bold" target="_blank" rel="noopener noreferrer">$1</a>');

  // List items (- item)
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-6 list-disc text-slate-300 my-1.5">$1</li>');

  // Paragraphs by double newlines
  html = html.split(/\r?\n\r?\n/).map(p => {
    const trimmed = p.trim();
    if (!trimmed) return "";
    
    // Skip wrapping if it is already heading/list
    if (trimmed.startsWith('<h') || trimmed.startsWith('<li') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
      return trimmed;
    }
    return `<p class="text-base md:text-lg text-slate-300 leading-relaxed mb-5">${trimmed}</p>`;
  }).join('\n');

  return html;
}
