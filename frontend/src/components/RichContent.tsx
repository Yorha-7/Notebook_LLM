import { useEffect, useRef } from 'react';
import katex from 'katex';
import mermaid from 'mermaid';
import { parseRichContent } from '../utils/richContent';

interface RichContentProps {
  content: string;
  className?: string;
}

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

export function RichContent({ content, className = '' }: RichContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Render LaTeX
    const latexElements = containerRef.current.querySelectorAll('.latex-inline, .latex-block');
    latexElements.forEach((el) => {
      const latex = el.getAttribute('data-latex');
      if (!latex) return;

      try {
        el.innerHTML = katex.renderToString(latex, {
          displayMode: el.classList.contains('latex-block'),
          throwOnError: false,
          output: 'html',
        });
      } catch (e) {
        el.innerHTML = `<span class="text-red-400">${latex}</span>`;
      }
    });

    // Render Mermaid diagrams
    const mermaidElements = containerRef.current.querySelectorAll('.mermaid-block');
    mermaidElements.forEach(async (el) => {
      const code = el.getAttribute('data-diagram');
      if (!code) return;

      const decoded = decodeURIComponent(code);
      const id = el.id || 'mermaid-' + Math.random().toString(36).substr(2, 9);

      try {
        const { svg } = await mermaid.render(id, decoded);
        el.innerHTML = svg;
      } catch (e) {
        el.innerHTML = `<pre class="text-red-400 text-sm p-2 bg-slate-800 rounded">${decoded}</pre>`;
      }
    });
  }, [content]);

  const parsed = parseRichContent(content);

  return (
    <div 
      ref={containerRef}
      className={`rich-content ${className}`}
      dangerouslySetInnerHTML={parsed}
    />
  );
}

// Simplified version for inline content
export function LatexSpan({ tex, className = '' }: { tex: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current || !tex) return;
    try {
      ref.current.innerHTML = katex.renderToString(tex, {
        displayMode: false,
        throwOnError: false,
      });
    } catch (e) {
      ref.current.innerHTML = tex;
    }
  }, [tex]);

  return (
    <span ref={ref} className={className} />
  );
}

// For rendering mermaid diagrams
export function MermaidDiagram({ code, className = '' }: { code: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !code) return;

    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);

    mermaid.render(id, code)
      .then(({ svg }) => {
        ref.current!.innerHTML = svg;
      })
      .catch((e) => {
        ref.current!.innerHTML = `<pre class="text-red-400">Error: ${e.message}</pre>`;
      });
  }, [code]);

  return (
    <div ref={ref} className={`mermaid-container ${className}`} />
  );
}