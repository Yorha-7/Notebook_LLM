export function parseMarkdown(text: string): { __html: string } {
  if (!text) return { __html: '' };
  
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  html = html
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-blue-400 mt-8 mb-4">$1</h1>');
  
  html = html.replace(/^\* (.+)$/gm, '<li class="ml-4 mb-1 text-slate-300">$1</li>');
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 mb-1 text-slate-300">$1</li>');
  
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  
  html = html.replace(/^\|(.+)\|(.+)\|$/gm, (match, col1, col2) => {
    if (match.includes('---')) return '';
    return `<tr class="border-b border-slate-700"><td class="py-2 px-3 text-slate-300">${col1}</td><td class="py-2 px-3 text-slate-300">${col2}</td></tr>`;
  });
  
  html = html.replace(/\|(.+)\|(.+)\|/g, (_match, col1, col2) => {
    return `<tr class="border-b border-slate-700"><td class="py-2 px-3 text-slate-300">${col1}</td><td class="py-2 px-3 text-slate-300">${col2}</td></tr>`;
  });
  
  const tableMatch = html.match(/<table>/);
  if (tableMatch) {
    html = html.replace(/<table>/g, '<table class="w-full mt-4 mb-6">');
  }
  
  html = html.replace(/\n\n/g, '</p><p class="text-slate-300 mb-4">');
  html = `<div class="study-guide-content"><p class="text-slate-300 mb-4">${html}</p></div>`;
  
  return { __html: html };
}