// PDF File Parser - extract text from PDF files using pdfjs-dist
import type { ParsedBook } from './txtParser';

// Worker source - use the legacy build which has better cross-platform support
// This is bundled with pdfjs-dist and works on Android WebView
let pdfjsLib: any = null;

async function getPdfJsLib() {
  if (pdfjsLib) return pdfjsLib;
  
  pdfjsLib = await import('pdfjs-dist');
  
  // Set worker source to the legacy build which has better Android WebView support
  // Using the legacy build since it's more compatible with older WebView versions
  
  // For Capacitor/Android, we need to handle the worker differently
  // Try to set the worker source, but don't fail if it doesn't work
  try {
    // Check if we're in a Capacitor/WebView environment
    const isCapacitor = !!(window as any).Capacitor;
    
    if (isCapacitor) {
      // On Android, use the legacy worker which has better compatibility
      // The legacy build doesn't require a separate worker file
      console.log('[parsePdfFile] Capacitor/Android environment detected');
      
      // For Capacitor, we'll use a different approach - inline worker
      // This avoids cross-origin issues with workers on Android WebView
      const pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
      pdfjsLib.GlobalWorkerOptions.workerPort = new pdfjsWorker.WorkerMessageHandler();
    } else {
      // For web, try to fetch the worker blob
      try {
        const response = await fetch('/pdf.worker.min.mjs');
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          pdfjsLib.GlobalWorkerOptions.workerSrc = url;
          console.log('[parsePdfFile] Worker loaded from blob URL');
        }
      } catch (_e) {
        console.warn('[parsePdfFile] Could not load worker blob, using default');
      }
    }
  } catch (e) {
    console.warn('[parsePdfFile] Worker setup warning:', e);
  }
  
  return pdfjsLib;
}

export async function parsePdfFile(file: File): Promise<ParsedBook> {
  console.log('[parsePdfFile] Starting with file:', file.name, file.size, 'bytes');
  
  const lib = await getPdfJsLib();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      console.log('[parsePdfFile] FileReader loaded, buffer size:', (event.target?.result as ArrayBuffer)?.byteLength);
      try {
        const typedArray = new Uint8Array(event.target?.result as ArrayBuffer);
        
        if (!typedArray || typedArray.length === 0) {
          throw new Error('File buffer is empty');
        }
        
        console.log('[parsePdfFile] Creating PDF document with', typedArray.length, 'bytes');
        
        const loadingTask = lib.getDocument({
          data: typedArray,
          useSystemFont: true, // Use system fonts for better Android compatibility
        });
        
        const pdf = await loadingTask.promise;
        console.log('[parsePdfFile] PDF loaded successfully, pages:', pdf.numPages);
        
        if (pdf.numPages === 0) {
          throw new Error('PDF has no pages');
        }
        
        let fullText = '';
        let totalItems = 0;
        const numPages = pdf.numPages;
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          console.log('[parsePdfFile] Processing page', pageNum, 'of', numPages);
          
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Get all text items from this page
          const pageTexts: string[] = [];
          for (const item of textContent.items) {
            if (item && typeof item === 'object' && 'str' in item) {
              const str = (item as any).str;
              if (str && str.trim()) {
                pageTexts.push(str.trim());
                totalItems++;
              }
            }
          }
          
          const pageText = pageTexts.join(' ');
          fullText += pageText + '\n';
          
          console.log('[parsePdfFile] Page', pageNum, 'text items:', pageTexts.length);
        }
        
        // Clean up the PDF document
        pdf.destroy();
        
        // Normalize whitespace and split into words
        const cleanedText = fullText.replace(/\s+/g, ' ').trim();
        const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
        
        console.log('[parsePdfFile] Extraction complete');
        console.log('[parsePdfFile] Total text items found:', totalItems);
        console.log('[parsePdfFile] Total words:', words.length);
        console.log('[parsePdfFile] Total characters:', cleanedText.length);
        
        // Check if we got any content
        if (words.length === 0 || cleanedText.length === 0) {
          console.warn('[parsePdfFile] WARNING: No text extracted from PDF!');
          console.warn('[parsePdfFile] This PDF may be a scanned/image-only document or have no text layer.');
          
          // Provide a helpful error instead of silently failing
          reject(new Error(
            'This PDF appears to contain no extractable text. ' +
            'It may be a scanned document or have no text layer. ' +
            'Please try a different PDF with selectable text.'
          ));
          return;
        }
        
        const fileName = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
        
        console.log('[parsePdfFile] SUCCESS - words:', words.length);
        resolve({
          title: fileName || 'Untitled PDF',
          author: 'Unknown Author',
          content: cleanedText,
          totalWords: words.length,
        });
      } catch (error) {
        console.error('[parsePdfFile] Parse error:', error);
        reject(new Error('Failed to parse PDF: ' + (error as Error)?.message));
      }
    };
    
    reader.onerror = (error) => {
      console.error('[parsePdfFile] FileReader error:', error);
      reject(new Error('Failed to read PDF file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}
