import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function markdownZuHtml(md: string): string {
  return DOMPurify.sanitize(marked.parse(md, { async: false, gfm: true, breaks: false }) as string);
}
