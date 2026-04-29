// TXT File Parser - extract text from plain text files
export interface ParsedBook {
  title: string;
  author: string;
  content: string;
  totalWords: number;
}

export async function parseTxtFile(file: File): Promise<ParsedBook> {
  console.log('[parseTxtFile] Starting with file:', file.name, 'size:', file.size);
  
  // Check if file has content
  if (!file || file.size === 0) {
    throw new Error('File is empty or invalid');
  }

  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const result = event.target?.result as string;
      console.log('[parseTxtFile] FileReader onload, bytes read:', result?.length);
      if (result) {
        resolve(result);
      } else {
        reject(new Error('FileReader returned no content'));
      }
    };
    
    reader.onerror = (error) => {
      console.error('[parseTxtFile] FileReader error:', error);
      reject(new Error('Failed to read file. Error code: ' + reader.error?.code));
    };
    
    reader.readAsText(file);
  });

  if (!content || content.trim().length === 0) {
    throw new Error('File content is empty');
  }

  const words = content.trim().split(/\s+/).filter(w => w.length > 0);
  const fileName = file.name.replace(/\.txt$/i, '').replace(/[-_]/g, ' ');
  
  console.log('[parseTxtFile] Success - words:', words.length, 'content length:', content.length);
  
  return {
    title: fileName || 'Untitled',
    author: 'Unknown Author',
    content: content.trim(),
    totalWords: words.length,
  };
}
