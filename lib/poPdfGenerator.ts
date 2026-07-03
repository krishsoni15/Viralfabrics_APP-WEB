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

export function generatePurchaseOrderPDF(po: any): jsPDF {
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

  // ─── 8. SUPPLIER GSTIN ROW ───
  y += 8.5;
  doc.setFont('helvetica', 'normal');
  doc.text('GSTIN : ', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(po.supplierGstin || '', margin + 17, y);
  // Underline across page
  doc.line(margin + 16, y + 1, rightMargin, y + 1);

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
  doc.text(po.rate || '', margin + 20, y);
  // Underline for Rate
  doc.line(margin + 19, y + 1, margin + 62, y + 1);

  // ─── 12. PAYMENT TERMS ROW (Supports Multi-line Payment Terms) ───
  y += 8.5;
  doc.setFont('helvetica', 'normal');
  doc.text('Payment Terms : ', margin, y);
  if (po.paymentTerms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const termLines = doc.splitTextToSize(po.paymentTerms, contentWidth - 34);
    termLines.forEach((tLine: string, index: number) => {
      if (index === 0) {
        doc.setFont('helvetica', 'bold');
        doc.text(tLine, margin + 34, y);
        doc.line(margin + 33, y + 1, rightMargin, y + 1);
      } else {
        y += 8.5;
        doc.setFont('helvetica', 'bold');
        doc.text(tLine, margin, y);
        doc.line(margin, y + 1, rightMargin, y + 1);
      }
    });
  } else {
    doc.line(margin + 33, y + 1, rightMargin, y + 1);
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
    { label: 'Finish Width:', value: specs.finishWidth || '' },
    { label: 'Weight:', value: specs.weight || '' }
  ];

  const tableX = margin;
  const labelWidth = 30;
  const valueWidth = 45;
  const tableWidth = labelWidth + valueWidth;
  const rowHeight = 7.5;

  // Table Outer Box
  doc.setLineWidth(0.35);
  doc.rect(tableX, y, tableWidth, rowHeight * specRows.length);

  // Vertical Divider Line
  doc.line(tableX + labelWidth, y, tableX + labelWidth, y + rowHeight * specRows.length);

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

  y += rowHeight * specRows.length + 8;

  // ─── 14. NOTES SECTION ───
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Notes : ', margin, y);

  // Underline for first Notes line
  doc.setLineWidth(0.3);
  doc.line(margin + 17, y + 1, rightMargin, y + 1);

  if (po.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const noteLines = doc.splitTextToSize(po.notes, contentWidth - 18);
    noteLines.forEach((nLine: string, index: number) => {
      if (index === 0) {
        doc.setFont('helvetica', 'bold');
        doc.text(nLine, margin + 18, y);
      } else {
        y += 8.5;
        doc.setFont('helvetica', 'bold');
        doc.text(nLine, margin, y);
        doc.line(margin, y + 1, rightMargin, y + 1);
      }
    });
  }

  // Draw 3 extra blank underline lines for Notes area to match reference style
  for (let i = 0; i < 3; i++) {
    y += 8.5;
    doc.line(margin, y + 1, rightMargin, y + 1);
  }

  return doc;
}

export function getPurchaseOrderPDFFileName(po: any): string {
  const company = (po.companyHeader || 'VIRAL_FABRICS')
    .toUpperCase()
    .replace(/\s+/g, '_');
  const num = cleanPoNumber(po.poNumber) || '000';
  return `PURCHASE_ORDER_${company}_${num}.pdf`;
}
