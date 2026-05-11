import type { ParsedBook } from './txtParser';
import type { BookChapter } from '../../domain/entities/Book';

interface ArticleBlock {
  type: 'heading' | 'paragraph';
  text: string;
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function countWords(value: string) {
  return collapseWhitespace(value).split(/\s+/).filter(Boolean).length;
}

function buildChaptersFromBlocks(blocks: ArticleBlock[]): BookChapter[] {
  const chapters: BookChapter[] = [];
  let wordOffset = 0;

  for (const block of blocks) {
    const wordCount = countWords(block.text);
    if (block.type === 'heading') {
      chapters.push({
        id: `chapter-${chapters.length + 1}`,
        title: collapseWhitespace(block.text),
        startWord: wordOffset,
        endWord: wordOffset,
      });
    }
    wordOffset += wordCount;
  }

  if (chapters.length === 0) {
    return [];
  }

  return chapters.map((chapter, index) => ({
    ...chapter,
    endWord: index < chapters.length - 1
      ? Math.max(chapters[index + 1].startWord - 1, chapter.startWord)
      : Math.max(wordOffset - 1, chapter.startWord),
  }));
}

function extractHtmlBlocks(doc: Document): ArticleBlock[] {
  const root = doc.querySelector('article') || doc.querySelector('main') || doc.body || doc.documentElement;
  const nodes = Array.from(root.querySelectorAll('h1, h2, h3, p, li, blockquote'));
  const blocks: ArticleBlock[] = [];

  for (const node of nodes) {
    const text = collapseWhitespace(node.textContent || '');
    if (!text || text.length < 2) {
      continue;
    }
    blocks.push({
      type: /^H[1-3]$/.test(node.tagName) ? 'heading' : 'paragraph',
      text,
    });
  }

  return blocks;
}

function extractMarkdownBlocks(text: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    const paragraph = collapseWhitespace(paragraphBuffer.join(' '));
    if (paragraph) {
      blocks.push({ type: 'paragraph', text: paragraph });
    }
    paragraphBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({ type: 'heading', text: headingMatch[1] });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks;
}

function extractTitleFromBlocks(blocks: ArticleBlock[], fallback: string) {
  const heading = blocks.find((block) => block.type === 'heading')?.text;
  if (heading) {
    return collapseWhitespace(heading);
  }
  return fallback;
}

function extractAuthorFromHtml(doc: Document) {
  const selectors = [
    'meta[name="author"]',
    'meta[property="article:author"]',
    '[rel="author"]',
    '[class*="author"]',
    '[class*="byline"]',
  ];

  for (const selector of selectors) {
    const node = doc.querySelector(selector);
    if (!node) continue;

    const value = node.getAttribute('content') || node.textContent || '';
    const author = collapseWhitespace(value.replace(/^by\s+/i, ''));
    if (author) {
      return author;
    }
  }

  return 'Unknown Author';
}

function extractAuthorFromText(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  const authorLine = lines.slice(0, 5).find((line) => /^(author|by)\s*:/i.test(line) || /^by\s+[A-Z]/.test(line));
  if (!authorLine) {
    return 'Unknown Author';
  }

  return collapseWhitespace(authorLine.replace(/^(author|by)\s*:/i, '').replace(/^by\s+/i, ''));
}

function blocksToContent(blocks: ArticleBlock[]) {
  return blocks.map((block) => block.text).join('\n\n').trim();
}

async function fetchArticleSource(articleUrl: string) {
  const directResponse = await fetch(articleUrl, { mode: 'cors' });
  if (directResponse.ok) {
    return directResponse.text();
  }

  throw new Error(`Direct fetch failed with status ${directResponse.status}`);
}

async function fetchArticleSourceWithFallback(articleUrl: string) {
  try {
    return await fetchArticleSource(articleUrl);
  } catch {
    const proxyUrl = `https://r.jina.ai/${articleUrl}`;
    const proxyResponse = await fetch(proxyUrl);
    if (!proxyResponse.ok) {
      throw new Error(`Article fetch failed with status ${proxyResponse.status}`);
    }
    return proxyResponse.text();
  }
}

export async function parseArticleUrl(articleUrl: string): Promise<ParsedBook> {
  const trimmedUrl = articleUrl.trim();
  const normalizedUrl = new URL(/^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`);
  const source = await fetchArticleSourceWithFallback(normalizedUrl.toString());
  const fileNameFallback = normalizedUrl.hostname.replace(/^www\./i, '') || 'Article';

  const isHtml = /<\/?[a-z][\s\S]*>/i.test(source);
  const blocks = isHtml
    ? (() => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(source, 'text/html');
        return extractHtmlBlocks(doc);
      })()
    : extractMarkdownBlocks(source);

  const content = blocksToContent(blocks);
  if (!content) {
    throw new Error('Could not extract readable article text from that URL');
  }

  const totalWords = content.split(/\s+/).filter(Boolean).length;

  let title = fileNameFallback;
  let author = 'Unknown Author';

  if (isHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'text/html');
    title = collapseWhitespace(
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
      doc.querySelector('title')?.textContent ||
      doc.querySelector('article h1, main h1, h1')?.textContent ||
      title,
    );
    author = extractAuthorFromHtml(doc);
  } else {
    title = extractTitleFromBlocks(blocks, title);
    author = extractAuthorFromText(source);
  }

  const chapters = buildChaptersFromBlocks(blocks);

  return {
    title,
    author,
    content,
    totalWords,
    chapters,
  };
}
