// Enhanced markdown parser with LaTeX and Mermaid support

export interface ParsedContent {
  __html: string;
}

// Parse content with LaTeX equations and Mermaid diagrams
export function parseRichContent(text: string | undefined | null): ParsedContent {
  if (!text) return { __html: '<span class="text-slate-500">No content</span>' };
  
  let html = escapeHtml(text);
  
  // Process markdown first
  html = processMarkdown(html);
  
  // Mark for LaTeX processing (will be rendered by KaTeX)
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, '<div class="latex-block" data-latex="$1"></div>');
  html = html.replace(/\$([^\$\n]+?)\$/g, '<span class="latex-inline" data-latex="$1"></span>');
  
  // Mark for Mermaid processing
  html = precompileMermaid(html);
  
  return { __html: html };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function processMarkdown(html: string): string {
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-6 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-blue-400 mt-6 mb-3">$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-white font-bold">$1</strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="text-slate-300 italic">$1</em>');
  
  // Lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 mb-1 text-slate-300">$1</li>');
  html = html.replace(/^\* (.+)$/gm, '<li class="ml-4 mb-1 text-slate-300">$1</li>');
  
  // Code blocks (```language)
  html = html.replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre class="bg-slate-900 p-3 rounded-lg overflow-x-auto"><code class="text-sm text-green-400">$2</code></pre>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-800 px-2 py-1 rounded text-sm text-green-400 font-mono">$1</code>');
  
  // Line breaks to paragraphs
  html = html.replace(/\n\n/g, '</p><p class="text-slate-300 mb-3">');
  html = '<p class="text-slate-300 mb-3">' + html + '</p>';
  
  return html;
}

function precompileMermaid(html: string): string {
  // Match mermaid blocks: ```mermaid ... ```
  const mermaidRegex = /```mermaid\n([\s\S]+?)```/g;
  
  return html.replace(mermaidRegex, (_match, code) => {
    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
    return `<div class="mermaid-block" data-diagram="${encodeURIComponent(code)}" id="${id}"></div>`;
  });
}

// Simple render for chat messages (less complex)
export function parseChatContent(text: string | undefined | null): ParsedContent {
  if (!text) return { __html: '' };
  
  let html = escapeHtml(text);
  html = processMarkdown(html);
  
  // Simple LaTeX for chat (inline only)
  html = html.replace(/\$([^\$\n]+?)\$/g, '<span class="latex-inline text-purple-400" data-latex="$1"></span>');
  
  return { __html: html };
}

// Detect if content has LaTeX or Mermaid
export function hasRichContent(text: string | undefined | null): boolean {
  if (!text) return false;
  return text.includes('$') || text.includes('```mermaid');
}

export { parseMarkdown } from './markdown';