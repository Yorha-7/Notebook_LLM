import requests
from config import settings
import re
import logging

logger = logging.getLogger("notebookllm")


def search_web(query: str, num_results: int = 5) -> list:
    """
    Search the web for relevant information using DuckDuckGo.
    Returns a list of search results with title, snippet, and URL.
    """
    try:
        url = "https://duckduckgo.com/html/"
        params = {"q": query, "kl": "wt-wt"}
        headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}
        
        response = requests.get(url, params=params, headers=headers, timeout=15)
        response.raise_for_status()
        
        results = []
        pattern = r'<a class="result__a" href="([^"]+)"[^>]*>([^<]+)</a>'
        snippet_pattern = r'<a class="result__snippet"[^>]*>([^<]+)</a>'
        
        matches = re.findall(pattern, response.text)
        snippets = re.findall(snippet_pattern, response.text)
        
        for i, (url, title) in enumerate(matches[:num_results]):
            snippet = snippets[i] if i < len(snippets) else ""
            results.append({
                "title": re.sub(r'<[^>]+>', '', title),
                "url": url,
                "snippet": re.sub(r'<[^>]+>', '', snippet) if snippet else ""
            })
        
        return results
    except requests.exceptions.Timeout:
        logger.warning(f"Web search timed out for query: {query}")
        return []
    except requests.exceptions.ConnectionError:
        logger.warning(f"Web search connection failed for query: {query}")
        return []
    except Exception as e:
        logger.warning(f"Web search error for '{query}': {e}")
        return []


def fetch_page_content(url: str) -> str:
    """
    Fetch the content of a web page for additional context.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        text = response.text
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'https?://\S+', '', text)
        text = text.strip()
        
        return text[:3000]
    except requests.exceptions.Timeout:
        logger.warning(f"Page fetch timed out: {url}")
        return ""
    except requests.exceptions.ConnectionError:
        logger.warning(f"Page fetch connection failed: {url}")
        return ""
    except Exception as e:
        logger.warning(f"Page fetch error for '{url}': {e}")
        return ""


def research_topic(topic: str, num_results: int = 3) -> str:
    """
    Research a topic by searching the web and fetching relevant content.
    Returns combined research context.
    """
    results = search_web(topic, num_results)
    
    if not results:
        return ""
    
    context = f"Additional research on '{topic}':\n\n"
    
    for i, result in enumerate(results, 1):
        context += f"{i}. {result['title']}\n"
        if result['snippet']:
            context += f"   {result['snippet']}\n"
        context += f"   Source: {result['url']}\n\n"
        
        # Fetch some content from top results
        if i <= 2 and result['url']:
            content = fetch_page_content(result['url'])
            if content:
                context += f"   Relevant content: {content[:500]}...\n\n"
    
    return context


def enhance_content_with_research(content: str, subject_hint: str = "") -> str:
    """
    Enhance content by researching key topics from the content.
    Extracts key terms and searches for additional context.
    """
    words = content.split()
    key_terms = []
    
    academic_terms = [w for w in words if (len(w) > 5 and w[0].isupper()) or any(c.isdigit() for c in w)]
    technical_terms = [w for w in words if any(term in w.lower() for term in ['theory', 'formula', 'equation', 'principle', 'theorem', 'law', 'effect'])]
    
    key_terms = academic_terms[:3] + technical_terms[:3]
    
    if not key_terms:
        key_terms = words[:10]
    
    research_context = ""
    for term in key_terms[:2]:
        try:
            result = research_topic(term, num_results=2)
            if result:
                research_context += result + "\n"
        except Exception as e:
            logger.warning(f"Research error for term '{term}': {e}")
            continue
    
    return research_context


def research_for_exam_paper(subject: str, topics: list) -> str:
    """
    Research multiple topics relevant to an exam paper.
    Returns comprehensive research context.
    """
    context = f"# Research Materials for: {subject}\n\n"
    
    for topic in topics[:5]:
        try:
            logger.info(f"Researching: {topic}")
            result = research_topic(topic, num_results=3)
            if result:
                context += result + "\n---\n\n"
        except Exception as e:
            logger.warning(f"Research error for topic '{topic}': {e}")
            continue
    
    return context if len(context) > 50 else ""