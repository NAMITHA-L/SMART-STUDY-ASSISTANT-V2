import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

/**
 * Heuristically extracts printable strings (ASCII and UTF-16-LE) from binary files
 * like legacy .ppt, .doc, .xls, and unknown format documents.
 * This ensures the application never crashes or rejects any document.
 */
export const extractBinaryStringsHeuristically = (arrayBuffer: ArrayBuffer, fileName: string): string => {
  const bytes = new Uint8Array(arrayBuffer);
  // Cap reading at 15MB to ensure superb performance even on large binary uploads
  const len = Math.min(bytes.length, 15 * 1024 * 1024);
  
  const rawLines: string[] = [];
  let currentAscii = '';
  let currentUtf16 = '';

  // 1. Scan for ASCII (Single-byte printable characters)
  for (let i = 0; i < len; i++) {
    const code = bytes[i];
    // Printable characters: space (32) to ~ (126), tab (9), newline (10), CR (13)
    if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) {
      currentAscii += String.fromCharCode(code);
    } else {
      if (currentAscii.length >= 5) {
        // Simple line filtering
        const lines = currentAscii.split(/[\r\n]+/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length >= 5 && /[a-zA-Z0-9]/.test(trimmed)) {
            // Avoid typical XML schema or system noise
            if (!trimmed.includes('</') && !trimmed.includes('<xml') && !trimmed.includes('xmlns:')) {
              rawLines.push(trimmed);
            }
          }
        }
      }
      currentAscii = '';
    }
  }
  if (currentAscii.length >= 5) {
    const lines = currentAscii.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length >= 5 && /[a-zA-Z0-9]/.test(trimmed)) {
        rawLines.push(trimmed);
      }
    }
  }

  // 2. Scan for UTF-16-LE (Two-byte wide-char strings typical in MS Office binary files like .ppt/.doc)
  for (let i = 0; i < len - 1; i += 2) {
    const low = bytes[i];
    const high = bytes[i + 1];
    if (high === 0 && ((low >= 32 && low <= 126) || low === 9 || low === 10 || low === 13)) {
      currentUtf16 += String.fromCharCode(low);
    } else {
      if (currentUtf16.length >= 5) {
        const lines = currentUtf16.split(/[\r\n]+/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length >= 5 && /[a-zA-Z0-9]/.test(trimmed)) {
            rawLines.push(trimmed);
          }
        }
      }
      currentUtf16 = '';
      // Backtrack to keep alignment search robust
      i--;
    }
  }
  if (currentUtf16.length >= 5) {
    const lines = currentUtf16.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length >= 5 && /[a-zA-Z0-9]/.test(trimmed)) {
        rawLines.push(trimmed);
      }
    }
  }

  // Filter out redundant noise lines
  const uniqueLines = Array.from(new Set(rawLines));
  const filteredLines = uniqueLines.filter(line => {
    const trimmed = line.trim();
    // Skip if noise ratio is too high (more than 30% non-alphanumeric chars)
    const nonAlphanumericCount = (trimmed.match(/[^a-zA-Z0-9\s]/g) || []).length;
    if (nonAlphanumericCount > trimmed.length * 0.3) return false;
    
    // Skip single boilerplate keywords of OLE structured files
    if (/^(Font|Color|Slide|Shape|Window|Office|Microsoft|Document|Summary|Company|Author|CreationDate|ModDate|Creator|Producer|Normal|Standard)$/i.test(trimmed)) {
      return false;
    }
    return true;
  });

  // Limit number of extracted items to maintain healthy context sizes (maximum 1500 high-yield text runs)
  const finalLines = filteredLines.slice(0, 1500);

  return `--- Extracted Slide & Text Content of Document: ${fileName} ---\n` +
         `[Heuristic Parser Info: Dynamic binary extraction recovered ${finalLines.length} academic text sequences]\n\n` +
         finalLines.join('\n') + '\n';
};

export const parseFileToText = async (fileData: string, mimeType: string, fileName: string): Promise<string | null> => {
  try {
    // Decode base64 to ArrayBuffer using fetch for better performance on large files
    const dataUrl = `data:${mimeType || 'application/octet-stream'};base64,${fileData}`;
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();

    const lowerName = fileName.toLowerCase();

    // 1. DOCX
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lowerName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ arrayBuffer });
      return `--- Content of ${fileName} ---\n${result.value}\n`;
    }

    // 2. XLSX or CSV
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      lowerName.endsWith('.xlsx') || 
      lowerName.endsWith('.xls') || 
      lowerName.endsWith('.csv')
    ) {
      try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        let text = `--- Content of ${fileName} ---\n`;
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          text += `\nSheet: ${sheetName}\n`;
          text += XLSX.utils.sheet_to_csv(sheet);
        });
        return text;
      } catch (xlsxErr) {
        console.warn(`Excel specialized parsing failed for ${fileName}, falling back to heuristic strings extraction:`, xlsxErr);
        return extractBinaryStringsHeuristically(arrayBuffer, fileName);
      }
    }

    // 3. PPTX (Modern open XML PowerPoint)
    if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || lowerName.endsWith('.pptx')) {
      try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        let text = `--- Content of ${fileName} ---\n`;
        
        const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
        
        // Sort slides numerically
        slideFiles.sort((a, b) => {
          const aNum = parseInt(a.replace(/[^0-9]/g, ''));
          const bNum = parseInt(b.replace(/[^0-9]/g, ''));
          return aNum - bNum;
        });

        for (const slideFile of slideFiles) {
          const content = await zip.files[slideFile].async('string');
          // Simple regex to extract text from a:t tags
          const matches = content.match(/<a:t>([^<]*)<\/a:t>/g);
          if (matches) {
            const slideText = matches.map(m => m.replace(/<a:t>/, '').replace(/<\/a:t>/, '')).join(' ');
            text += `\n[Slide]\n${slideText}\n`;
          }
        }
        return text;
      } catch (pptxErr) {
        console.warn(`PPTX zip-based parsing failed for ${fileName}, falling back to heuristic strings extraction:`, pptxErr);
        return extractBinaryStringsHeuristically(arrayBuffer, fileName);
      }
    }

    // 4. Plain Text or Code files
    if (mimeType.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.json') || lowerName.endsWith('.js') || lowerName.endsWith('.ts')) {
      const textDecoder = new TextDecoder('utf-8');
      const text = textDecoder.decode(arrayBuffer);
      return `--- Content of ${fileName} ---\n${text}\n`;
    }

    // 5. PDF Client-side Text Extraction
    if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let text = `--- Content of PDF: ${fileName} ---\n`;

        for (let i = 1; i <= pdf.numPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str || '')
              .join(' ');
            text += `\n[Page ${i}]\n${pageText}\n`;
          } catch (pageErr) {
            console.error(`Error parsing page ${i} of ${fileName}:`, pageErr);
          }
        }
        return text;
      } catch (pdfErr) {
        console.warn("Client-side PDF extraction failed, falling back to heuristic strings extraction:", pdfErr);
        return extractBinaryStringsHeuristically(arrayBuffer, fileName);
      }
    }

    // 6. Native Media support (Images, Audio, Video are sent directly as raw inlineData to Gemini 3.5 Flash)
    if (
      mimeType.startsWith('image/') ||
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/')
    ) {
      return null;
    }

    // 7. Dynamic Heuristic Extraction for any other legacy binary format (.ppt, .doc, unknown extensions, etc.)
    console.log(`Running dynamic heuristic extraction for legacy binary document: ${fileName} (${mimeType})`);
    return extractBinaryStringsHeuristically(arrayBuffer, fileName);

  } catch (error: any) {
    console.error(`Error processing file ${fileName}:`, error);
    // Even if it completely errored, don't crash the entire pipeline! Return a salvage notice.
    return `--- Document Reference: ${fileName} ---\n[Warning: Specialized text parsing failed. Native metadata placeholder created.]\n`;
  }
};
