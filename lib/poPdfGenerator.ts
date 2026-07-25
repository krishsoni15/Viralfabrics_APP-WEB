import jsPDF from 'jspdf';

// Company header data
const COMPANY_HEADERS = {
  'Viral Fabrics': {
    name: 'VIRAL FABRICS',
    address: 'PLOT NO.37-38, KRISHNA IND.SOC., OPP.UMIYA RESI. BAMROLI,PANDESARA, SURAT 394210',
    phone: 'Phone: 094279 88999',
    gstin: '24AXYPP4119J1ZW'
  },
  'Viral Enterprise': {
    name: 'VIRAL ENTERPRISE',
    address: 'Plot 37,38, Krishna Industrial Society, Opposite Umiya Residency, Near Milan Point, Bamroli - Vadod Road, Bamroli, Pandesara, Surat. Pin: 394210',
    phone: 'Phone: +91-9427988999',
    gstin: '24AAJHV2286E1Z0'
  }
};

function formatDateDDMMYYYY(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function cleanPoNumber(poNumber?: string | null): string {
  if (!poNumber) return '';
  const idStr = String(poNumber).trim();
  const parts = idStr.split(/[\/\-\s]+/);
  const lastPart = parts[parts.length - 1];
  if (lastPart && /^\d+$/.test(lastPart)) {
    return lastPart;
  }
  return idStr.replace(/^FY\s*-?\s*/i, '');
}

async function getBase64Image(url: string): Promise<{ dataUrl: string; format: string; width: number; height: number } | null> {
  try {
    let fetchUrl = url;
    
    // If in the browser and the URL is absolute and external, proxy it to bypass CORS restrictions
    if (typeof window !== 'undefined' && (url.startsWith('http://') || url.startsWith('https://'))) {
      if (!url.includes(window.location.host)) {
        fetchUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
      }
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    
    // Cross-environment arraybuffer to base64
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(arrayBuffer).toString('base64');
    
    let format = 'JPEG';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.endsWith('.png')) {
      format = 'PNG';
    } else if (lowerUrl.endsWith('.webp')) {
      format = 'WEBP';
    }
    
    const dataUrl = `data:image/${format.toLowerCase()};base64,${base64}`;
    
    let width = 100;
    let height = 100;

    if (typeof window !== 'undefined') {
      const img = new window.Image();
      await new Promise<void>((resolve) => {
        img.onload = () => {
          width = img.width || 100;
          height = img.height || 100;
          resolve();
        };
        img.onerror = () => {
          resolve();
        };
        img.src = dataUrl;
      });
    }
    
    return {
      dataUrl,
      format,
      width,
      height
    };
  } catch (err) {
    console.error('Error fetching image for PDF:', err);
    return null;
  }
}

export async function generatePurchaseOrderPDF(po: any): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 15; // Clean 15mm page margin
  const contentWidth = pageWidth - margin * 2; // 180mm
  const rightMargin = margin + contentWidth;
  let y = 23; // Increased top margin above Company Header for clean breathing space

  const header = COMPANY_HEADERS[po.companyHeader as keyof typeof COMPANY_HEADERS] || COMPANY_HEADERS['Viral Fabrics'];

  // ─── 1. COMPANY HEADER ───
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(header.name, pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const addressLines = doc.splitTextToSize(header.address, contentWidth);
  doc.text(addressLines, pageWidth / 2, y, { align: 'center' });

  y += (addressLines.length * 4.2);
  doc.setFontSize(8.5);
  doc.text(header.phone, pageWidth / 2, y, { align: 'center' });

  // ─── 2. GSTIN & PURCHASE ORDER ROW ───
  y += 7;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('GSTIN : ', margin, y);

  doc.setFont('helvetica', 'bold');
  doc.text(header.gstin, margin + 16, y);
  // Underline for company GSTIN
  doc.setLineWidth(0.4);
  const gstinWidth = doc.getTextWidth(header.gstin);
  doc.line(margin + 16, y + 1, margin + 16 + gstinWidth + 2, y + 1);

  // PURCHASE ORDER title (Dead center on page width)
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER', pageWidth / 2, y, { align: 'center' });

  // Elegant divider line below header section
  y += 4;
  doc.setLineWidth(0.35);
  doc.line(margin, y, rightMargin, y);

  // ─── 3. PO NO & DATE ROW ───
  y += 7.5;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('PO No. : ', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(cleanPoNumber(po.poNumber), margin + 17, y);
  // Underline for PO No
  doc.setLineWidth(0.3);
  doc.line(margin + 17, y + 1, margin + 62, y + 1);

  // Date
  const dateStr = formatDateDDMMYYYY(po.poDate);
  doc.setFont('helvetica', 'normal');
  doc.text('Date : ', rightMargin - 45, y);
  doc.setFont('helvetica', 'bold');
  doc.text(dateStr, rightMargin - 32, y);
  doc.setLineWidth(0.35);
  doc.line(rightMargin - 33, y + 1, rightMargin, y + 1);

  // ─── 4. BROKER NAME ROW ───
  y += 8.5;
  doc.setFont('helvetica', 'normal');
  doc.text('Broker Name', margin, y);
  doc.text(':', margin + 28, y);
  doc.setFont('helvetica', 'bold');
  doc.text(po.brokerName || '', margin + 32, y);
  // Underline across page
  doc.setLineWidth(0.3);
  doc.line(margin + 31, y + 1, rightMargin, y + 1);

  // ─── 5. MOBILE NO ROW ───
  y += 8.5;
  doc.setFont('helvetica', 'normal');
  doc.text('Mobile No.', margin, y);
  doc.text(':', margin + 28, y);
  doc.setFont('helvetica', 'bold');
  doc.text(po.brokerPhone || '', margin + 32, y);
  // Underline across page
  doc.line(margin + 31, y + 1, rightMargin, y + 1);

  // Elegant section divider line below Broker section
  y += 4;
  doc.setLineWidth(0.35);
  doc.line(margin, y, rightMargin, y);

  // ─── 6. SUPPLIER NAME ROW ───
  y += 7.5;
  doc.setFont('helvetica', 'normal');
  doc.text('Supplier Name', margin, y);
  doc.text(':', margin + 28, y);
  doc.setFont('helvetica', 'bold');
  doc.text(po.supplierName || '', margin + 32, y);
  // Underline across page
  doc.setLineWidth(0.3);
  doc.line(margin + 31, y + 1, rightMargin, y + 1);

  // ─── 7. SUPPLIER ADDRESS LINES ───
  if (po.supplierAddress) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const sAddrLines = doc.splitTextToSize(po.supplierAddress, contentWidth - 32);
    sAddrLines.forEach((line: string) => {
      y += 8.5;
      doc.setFont('helvetica', 'bold');
      doc.text(line, margin, y);
      // Underline full width across page for each address line
      doc.line(margin, y + 1, rightMargin, y + 1);
    });
  }

  // ─── 8. SUPPLIER GSTIN & MOBILE ROW ───
  y += 8.5;
  doc.setFont('helvetica', 'normal');
  doc.text('GSTIN : ', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(po.supplierGstin || '', margin + 17, y);

  // Supplier Mobile Number on same row
  doc.setFont('helvetica', 'normal');
  doc.text('Mobile No. : ', margin + 85, y);
  doc.setFont('helvetica', 'bold');
  doc.text(po.supplierPhone || '', margin + 106, y);

  // Underlines for GSTIN value and Mobile No value separately
  doc.line(margin + 16, y + 1, margin + 62, y + 1);
  doc.line(margin + 105, y + 1, rightMargin, y + 1);

  // Elegant section divider line below Supplier section
  y += 4;
  doc.setLineWidth(0.35);
  doc.line(margin, y, rightMargin, y);

  // ─── 9. QUALITY ROW ───
  y += 7.5;
  doc.setFont('helvetica', 'normal');
  doc.text('Quality : ', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(po.quality || '', margin + 18, y);
  // Underline across page
  doc.setLineWidth(0.3);
  doc.line(margin + 17, y + 1, rightMargin, y + 1);

  // Elegant section divider line below Quality
  y += 4;
  doc.setLineWidth(0.35);
  doc.line(margin, y, rightMargin, y);

  // ─── 10. PCS/MTR & DELIVERY ROW ───
  y += 7.5;
  doc.setFont('helvetica', 'normal');
  doc.text('Pcs/Mtr : ', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(po.pcsMtr || '', margin + 18, y);
  // Underline for Pcs/Mtr
  doc.setLineWidth(0.3);
  doc.line(margin + 17, y + 1, margin + 62, y + 1);

  // Delivery on same line
  doc.setFont('helvetica', 'normal');
  doc.text('Delivery : ', margin + 85, y);
  doc.setFont('helvetica', 'bold');
  doc.text(po.delivery || '', margin + 104, y);
  // Underline for Delivery
  doc.line(margin + 103, y + 1, rightMargin, y + 1);

  // ─── 11. RATE ROW ───
  y += 8.5;
  doc.setFont('helvetica', 'normal');
  doc.text('Rate', margin, y);
  doc.text(':', margin + 16, y);
  doc.setFont('helvetica', 'bold');
  const formattedRate = po.rate ? (/gst/i.test(po.rate) ? po.rate : `${po.rate} + GST`) : '';
  doc.text(formattedRate, margin + 20, y);
  // Underline for Rate
  doc.line(margin + 19, y + 1, margin + 62, y + 1);

  // Greigh Lead Time on same row
  doc.setFont('helvetica', 'normal');
  doc.text('Greigh Lead Time : ', margin + 85, y);
  doc.setFont('helvetica', 'bold');
  doc.text(po.greighLeadTime || '', margin + 120, y);
  doc.line(margin + 119, y + 1, rightMargin, y + 1);

  // ─── 11b. GREIGH MTR ROW ───
  y += 8.5;
  doc.setFont('helvetica', 'normal');
  doc.text('Greigh Mtr', margin, y);
  doc.text(':', margin + 16, y);
  doc.setFont('helvetica', 'bold');
  doc.text(po.greighMtr || '', margin + 20, y);
  doc.line(margin + 19, y + 1, margin + 62, y + 1);

  // ─── 12. PAYMENT TERMS ROW (Supports Multi-line Payment Terms) ───
  y += 8.5;
  if (y > 270) {
    doc.addPage();
    y = 23;
  }
  doc.setFont('helvetica', 'normal');
  doc.text('Payment Terms : ', margin, y);
  if (po.paymentTerms) {
    const res = renderStyledHtmlToPdf(
      doc,
      po.paymentTerms,
      margin + 34,
      y,
      contentWidth - 34,
      margin,
      9.5,
      8.5,
      true,
      rightMargin
    );
    y = res.endY;
  }

  // Elegant section divider line below Payment Terms
  y += 4;
  doc.setLineWidth(0.35);
  doc.line(margin, y, rightMargin, y);

  // ─── 13. SPECIFICATIONS TABLE ───
  y += 6.5;
  const specs = po.specs || {};
  const specRows = [
    { label: 'Finish GSM:', value: specs.finishGsm || '' },
    { label: 'Grey Width:', value: specs.greyWidth || '' },
    { key: 'finishWidth', label: 'Finish Width:', value: specs.finishWidth || '' },
    { key: 'weight', label: 'Weight:', value: specs.weight || '' }
  ];

  const tableX = margin;
  const labelWidth = 30;
  const valueWidth = 45;
  const tableWidth = labelWidth + valueWidth; // 75mm
  const rowHeight = 7.5;

  const specTableHeight = rowHeight * specRows.length; // 30mm
  const imageGridHeight = po.images && po.images.length > 0 
    ? Math.ceil(po.images.length / 2) * 35 - 4 
    : 0;
  const specsSectionHeight = Math.max(specTableHeight, imageGridHeight);

  if (y + specsSectionHeight > 275) {
    doc.addPage();
    y = 23;
  }

  // Table Outer Box
  doc.setLineWidth(0.35);
  doc.rect(tableX, y, tableWidth, specTableHeight);

  // Vertical Divider Line
  doc.line(tableX + labelWidth, y, tableX + labelWidth, y + specTableHeight);

  specRows.forEach((row, i) => {
    const rowY = y + i * rowHeight;

    // Horizontal inner row line
    if (i > 0) {
      doc.line(tableX, rowY, tableX + tableWidth, rowY);
    }

    // Label (Bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(row.label, tableX + 2, rowY + 5.2);

    // Value (Bold)
    doc.setFont('helvetica', 'bold');
    doc.text(String(row.value), tableX + labelWidth + 3, rowY + 5.2);
  });

  // Render Images on the right side of Specifications table
  const specTableStartY = y;
  if (po.images && po.images.length > 0) {
    const isSingleImage = po.images.length === 1;
    const imageWidth = 42;
    const imageHeight = 31;
    const gapX = 4;
    const gapY = 4;
    const startX = margin + tableWidth + 7; // 15 + 75 + 7 = 97
    const availableWidth = rightMargin - startX; // 195 - 97 = 98
    
    for (let index = 0; index < po.images.length; index++) {
      const imageUrl = po.images[index];
      const imgData = await getBase64Image(imageUrl);
      if (imgData) {
        let imgX = startX;
        let imgY = specTableStartY;
        let maxWidth = imageWidth;
        let maxHeight = imageHeight;
        
        if (isSingleImage) {
          maxWidth = 46;
          maxHeight = 31;
          imgX = startX + (availableWidth - maxWidth) / 2;
        } else {
          const row = Math.floor(index / 2);
          const col = index % 2;
          imgX = startX + col * (imageWidth + gapX);
          imgY = specTableStartY + row * (imageHeight + gapY);
        }
        
        // Calculate aspect ratio preserving dimensions within bounding box of maxWidth x maxHeight
        const imgAspect = imgData.width / imgData.height;
        const boxAspect = maxWidth / maxHeight;
        
        let renderWidth = maxWidth;
        let renderHeight = maxHeight;
        
        if (imgAspect > boxAspect) {
          // Image is wider than bounding box aspect ratio -> clamp width
          renderWidth = maxWidth;
          renderHeight = maxWidth / imgAspect;
        } else {
          // Image is taller than bounding box aspect ratio -> clamp height
          renderHeight = maxHeight;
          renderWidth = maxHeight * imgAspect;
        }
        
        // Center the image inside the grid slot
        const xOffset = (maxWidth - renderWidth) / 2;
        const yOffset = (maxHeight - renderHeight) / 2;
        
        doc.addImage(imgData.dataUrl, imgData.format, imgX + xOffset, imgY + yOffset, renderWidth, renderHeight);
      }
    }
  }

  y += specsSectionHeight + 8;
  if (y > 255) {
    doc.addPage();
    y = 23;
  }

  // ─── 14. NOTES SECTION ───
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Notes : ', margin, y);

  let notesLineCount = 0;

  if (po.notes) {
    const res = renderStyledHtmlToPdf(
      doc,
      po.notes,
      margin + 18,
      y,
      contentWidth - 18,
      margin,
      9.5,
      8.5,
      true,
      rightMargin
    );
    y = res.endY;
    notesLineCount = res.lineCount;
  } else {
    // Underline for first Notes line if empty
    doc.setLineWidth(0.3);
    doc.line(margin + 17, y + 1, rightMargin, y + 1);
    notesLineCount = 1;
  }

  // Draw remaining empty notebook line rules to guarantee AT LEAST 4 total lines minimum
  const totalMinLines = 4;
  const remainingEmptyLines = Math.max(0, totalMinLines - notesLineCount);
  for (let i = 0; i < remainingEmptyLines; i++) {
    // Check if adding rules reaches bottom limit
    if (y > 275) {
      doc.addPage();
      y = 23;
    } else {
      y += 8.5;
    }
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1, rightMargin, y + 1);
  }

  return doc;
}

interface StyledSpan {
  text: string;
  b: boolean;
  i: boolean;
  u: boolean;
}

function normalizeHtml(htmlStr?: string): string {
  if (!htmlStr) return '';
  return htmlStr
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<span[^>]*font-weight:\s*bold[^>]*>(.*?)<\/span>/gi, '<b>$1</b>')
    .replace(/<span[^>]*font-weight:\s*bolder[^>]*>(.*?)<\/span>/gi, '<b>$1</b>')
    .replace(/<span[^>]*font-style:\s*italic[^>]*>(.*?)<\/span>/gi, '<i>$1</i>')
    .replace(/<span[^>]*text-decoration:\s*underline[^>]*>(.*?)<\/span>/gi, '<u>$1</u>')
    .replace(/<span[^>]*>(.*?)<\/span>/gi, '$1')
    .replace(/<\/span>/gi, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

function parseStyledSegments(rawHtml: string): StyledSpan[] {
  if (!rawHtml) return [];
  const normalized = normalizeHtml(rawHtml);

  const tagRegex = /<\/?(b|i|u|strong|em)[^>]*>/gi;
  const spans: StyledSpan[] = [];
  let b = false, i = false, u = false;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(normalized)) !== null) {
    const textChunk = normalized.substring(lastIdx, match.index);
    if (textChunk) {
      spans.push({ text: textChunk, b, i, u });
    }

    const tag = match[0].toLowerCase();
    if (tag.startsWith('<b') || tag.startsWith('<strong')) b = true;
    else if (tag.startsWith('</b') || tag.startsWith('</strong')) b = false;
    else if (tag.startsWith('<i') || tag.startsWith('<em')) i = true;
    else if (tag.startsWith('</i') || tag.startsWith('</em')) i = false;
    else if (tag.startsWith('<u')) u = true;
    else if (tag.startsWith('</u')) u = false;

    lastIdx = tagRegex.lastIndex;
  }

  const remaining = normalized.substring(lastIdx);
  if (remaining) {
    spans.push({ text: remaining, b, i, u });
  }

  return spans;
}

function renderStyledHtmlToPdf(
  doc: jsPDF,
  rawHtml: string,
  startX: number,
  startY: number,
  maxWidth: number,
  leftMargin: number,
  fontSize: number = 9.5,
  lineHeight: number = 8.5,
  drawNotebookLines: boolean = false,
  rightMargin: number = 195
): { endY: number; lineCount: number } {
  const spans = parseStyledSegments(rawHtml);
  if (spans.length === 0) return { endY: startY, lineCount: 0 };

  let curX = startX;
  let curY = startY;
  let lineCount = 1;
  const rightBoundary = leftMargin + maxWidth;
  const bottomLimit = 275;

  const drawLineRule = (lineY: number, isFirst: boolean) => {
    if (!drawNotebookLines) return;
    const ruleStartX = isFirst ? startX - 1 : leftMargin;
    doc.setLineWidth(0.3);
    doc.line(ruleStartX, lineY + 1.2, rightMargin, lineY + 1.2);
  };

  const handlePageBreak = () => {
    if (curY > bottomLimit) {
      doc.addPage();
      curY = 23;
      curX = leftMargin;
      drawLineRule(curY, true);
    }
  };

  drawLineRule(curY, true);

  spans.forEach((span) => {
    let fontStyle = 'bold';
    if (span.b && span.i) fontStyle = 'bolditalic';
    else if (span.i) fontStyle = 'italic';
    else if (span.b) fontStyle = 'bold';
    else fontStyle = 'bold';

    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);

    const lines = span.text.split('\n');
    lines.forEach((lineText, lIdx) => {
      if (lIdx > 0) {
        curY += lineHeight;
        curX = leftMargin;
        lineCount++;
        handlePageBreak();
        drawLineRule(curY, false);
      }

      if (!lineText) return;

      const words = lineText.split(' ');
      words.forEach((word, wIdx) => {
        if (!word && wIdx > 0) {
          curX += doc.getTextWidth(' ');
          return;
        }

        const spacePrefix = (wIdx > 0 || (lIdx > 0 && curX > leftMargin)) ? ' ' : '';
        const wordWithSpace = spacePrefix + word;
        const wordWidth = doc.getTextWidth(wordWithSpace);

        if (curX + wordWidth > rightBoundary && curX > leftMargin) {
          curY += lineHeight;
          curX = leftMargin;
          lineCount++;
          handlePageBreak();
          drawLineRule(curY, false);

          const cleanWord = word;
          const cleanWidth = doc.getTextWidth(cleanWord);

          doc.setFont('helvetica', fontStyle);
          doc.setFontSize(fontSize);
          doc.text(cleanWord, curX, curY);

          if (span.u) {
            doc.setLineWidth(0.5);
            doc.line(curX, curY + 0.6, curX + cleanWidth, curY + 0.6);
          }

          curX += cleanWidth;
        } else {
          doc.setFont('helvetica', fontStyle);
          doc.setFontSize(fontSize);
          doc.text(wordWithSpace, curX, curY);

          if (span.u) {
            const spaceW = spacePrefix ? doc.getTextWidth(' ') : 0;
            const uStartX = curX + spaceW;
            const uWidth = doc.getTextWidth(word);
            doc.setLineWidth(0.5);
            doc.line(uStartX, curY + 0.6, uStartX + uWidth, curY + 0.6);
          }

          curX += wordWidth;
        }
      });
    });
  });

  return { endY: curY, lineCount };
}

export function getPurchaseOrderPDFFileName(po: any): string {
  const company = (po.companyHeader || 'VIRAL_FABRICS')
    .toUpperCase()
    .replace(/\s+/g, '_');
  const num = cleanPoNumber(po.poNumber) || '000';
  return `PURCHASE_ORDER_${company}_${num}.pdf`;
}
