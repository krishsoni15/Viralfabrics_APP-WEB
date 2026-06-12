import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface OrderData {
  orderId: string;
  orderType?: string;
  arrivalDate?: Date;
  party?: {
    name: string;
  };
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  poNumber?: string;
  styleNo?: string;
  poDate?: Date;
  deliveryDate?: Date;
  items: Array<{
    quality?: {
      name: string;
    };
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    description?: string;
    weaverSupplierName?: string;
    purchaseRate?: number;
    millRate?: number;
    salesRate?: number;
    imageUrls?: string[];
  }>;
  status: string;
  totalAmount: number;
  finalAmount: number;
  createdAt: Date;
  notes?: string;
  // Mill data
  millInputs?: Array<{
    mill: {
      name: string;
    };
    millDate: Date;
    chalanNo: string;
    greighMtr: number;
    pcs: number;
    quality?: {
      name: string;
    };
    additionalMeters?: Array<{
      greighMtr: number;
      pcs: number;
      quality?: {
        name: string;
      };
    }>;
  }>;
  millOutputs?: Array<{
    recdDate: Date;
    millBillNo: string;
    finishedMtr: number;
    millRate: number;
    quality?: {
      name: string;
    };
  }>;
  dispatches?: Array<{
    dispatchDate: Date;
    billNo: string;
    transportNo?: string;
    lrNo?: string;
    finishMtr: number;
    saleRate: number;
    quality?: {
      name: string;
    };
    totalValue: number;
  }>;
  // Grey information data
  greyInformation?: Array<{
    quality?: {
      _id: string;
      name: string;
    };
    quantity?: number;
    chalanNo?: string;
    numberOfPieces?: number;
    date?: Date;
  }>;
}

export const generateOrderPDF = (order: OrderData): any => {
  try {
    // Debug: Log the complete order object
    console.log('PDF Generator - Starting PDF generation for order:', order.orderId);
    console.log('PDF Generator - Complete Order Object:', order);
    console.log('PDF Generator - Mill Inputs:', order.millInputs);
    console.log('PDF Generator - Mill Inputs Length:', order.millInputs?.length);
    console.log('PDF Generator - Mill Inputs Type:', typeof order.millInputs);
    console.log('PDF Generator - Mill Inputs Array Check:', Array.isArray(order.millInputs));

    // Log each mill input individually
    if (order.millInputs && Array.isArray(order.millInputs)) {
      order.millInputs.forEach((input, index) => {
        console.log(`PDF Generator - Mill Input ${index}:`, input);
        console.log(`PDF Generator - Mill Input ${index} keys:`, Object.keys(input || {}));
      });
    }

    // Validate order data
    if (!order) {
      throw new Error('Order data is required');
    }

    if (!order.orderId) {
      throw new Error('Order ID is required');
    }

    // Ensure millInputs is an array
    if (!Array.isArray(order.millInputs)) {
      order.millInputs = [];
    }

    // Ensure millOutputs is an array
    if (!Array.isArray(order.millOutputs)) {
      order.millOutputs = [];
    }

    // Ensure dispatches is an array
    if (!Array.isArray(order.dispatches)) {
      order.dispatches = [];
    }

    // Ensure greyInformation is an array
    if (!Array.isArray(order.greyInformation)) {
      order.greyInformation = [];
    }

    // Get the quality ID from the first item to filter all data by quality
    const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
    const qualityId = firstItem?.quality && typeof firstItem.quality === 'object'
      ? (firstItem.quality as any)._id || null
      : null;

    // Debug: Log quality filtering info
    console.log('PDF Generator - Quality Filtering:', {
      qualityId: qualityId,
      qualityName: firstItem?.quality?.name || 'N/A',
      totalMillInputs: order.millInputs?.length || 0,
      totalMillOutputs: order.millOutputs?.length || 0,
      totalDispatches: order.dispatches?.length || 0
    });

    // Declare filtered arrays at higher scope for use in FINAL REPORT section
    let filteredMillOutputs: any[] = [];
    let filteredDispatches: any[] = [];

    // Filter grey information by quality (only show data for the current quality)
    const filteredGreyInfo = order.greyInformation?.filter((greyInfo) => {
      if (!qualityId || !greyInfo.quality) return false;
      const greyQualityId = typeof greyInfo.quality === 'object'
        ? (greyInfo.quality as any)._id || greyInfo.quality
        : greyInfo.quality;
      return String(greyQualityId) === String(qualityId);
    }) || [];

    console.log('PDF Generator - Quality ID:', qualityId);
    console.log('PDF Generator - All Grey Information:', order.greyInformation);
    console.log('PDF Generator - Filtered Grey Information:', filteredGreyInfo);

    // Calculate grey information totals early (quality-wise)
    const greyInfoTotalQuantity = filteredGreyInfo.reduce((total, entry) => {
      return total + (Number(entry.quantity) || 0);
    }, 0);

    const greyInfoTotalPieces = filteredGreyInfo.reduce((total, entry) => {
      return total + (Number(entry.numberOfPieces) || 0);
    }, 0);

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper function to format date
    const formatDate = (date: Date | undefined): string => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    };

    // Helper function to format currency
    const formatCurrency = (amount: number): string => {
      return amount.toFixed(2);
    };

    // Calculate totals from real data
    const calculateTotals = () => {
      // Calculate total greigh meters from mill inputs
      const totalGreighMtr = order.millInputs?.reduce((total, input) => {
        const mainMtr = input.greighMtr || 0;
        const additionalMtr = input.additionalMeters?.reduce((sum, add) => sum + (add.greighMtr || 0), 0) || 0;
        return total + mainMtr + additionalMtr;
      }, 0) || 0;

      // Calculate total finished meters from mill outputs
      const totalFinishedMtr = order.millOutputs?.reduce((total, output) => total + (output.finishedMtr || 0), 0) || 0;

      // Calculate total dispatch meters
      const totalDispatchMtr = order.dispatches?.reduce((total, dispatch) => total + (dispatch.finishMtr || 0), 0) || 0;

      // Calculate total mill cost
      const totalMillCost = order.millOutputs?.reduce((total, output) => total + ((output.finishedMtr || 0) * (output.millRate || 0)), 0) || 0;

      // Calculate total sales value
      const totalSalesValue = order.dispatches?.reduce((total, dispatch) => total + (dispatch.totalValue || 0), 0) || 0;

      // Calculate total pieces from mill inputs
      const totalPieces = order.millInputs?.reduce((total, input) => {
        const mainPcs = input.pcs || 0;
        const additionalPcs = input.additionalMeters?.reduce((sum, add) => sum + (add.pcs || 0), 0) || 0;
        return total + mainPcs + additionalPcs;
      }, 0) || 0;

      return {
        totalGreighMtr,
        totalFinishedMtr,
        totalDispatchMtr,
        totalMillCost,
        totalSalesValue,
        totalPieces
      };
    };

    const totals = calculateTotals();

    let yPosition = 6; // Top margin

    // Add Financial Year at the very top (right aligned)
    const fyMatch = (order.orderId || '').toUpperCase().match(/^FY(\d{2})(\d{2})-(\d+)$/);
    if (fyMatch) {
      const [, startYear, endYear] = fyMatch;
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`FY 20${startYear}-${endYear}`, pageWidth - 5, yPosition, { align: 'right' });
      yPosition += 3;
    }
    doc.setTextColor(0, 0, 0);

    // Start directly with the header row

    // Top Section - Header Row (4 columns in one row with borders)
    doc.setFontSize(10); // Smaller font for compactness
    doc.setFont('helvetica', 'bold');

    const leftCol = 5; // Minimal left margin
    const rightCol = 105; // Symmetrical gap between left and right sections (5mm gap)

    // Create table-like header row with borders
    const headerRowY = yPosition;
    const cellHeight = 8; // Very compact height
    const cellWidth1 = 55; // PARTY - increased for more spacing
    const cellWidth2 = 45; // PO NO - increased for more spacing
    const cellWidth3 = 50; // PO DATE - increased for more spacing
    const cellWidth4 = 50; // DELIVERY DATE - increased for more spacing

    // Draw borders for header row
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3); // Thinner borders

    // Horizontal lines
    doc.line(leftCol, headerRowY, leftCol + cellWidth1 + cellWidth2 + cellWidth3 + cellWidth4, headerRowY);
    doc.line(leftCol, headerRowY + cellHeight, leftCol + cellWidth1 + cellWidth2 + cellWidth3 + cellWidth4, headerRowY + cellHeight);

    // Vertical lines
    doc.line(leftCol, headerRowY, leftCol, headerRowY + cellHeight);
    doc.line(leftCol + cellWidth1, headerRowY, leftCol + cellWidth1, headerRowY + cellHeight);
    doc.line(leftCol + cellWidth1 + cellWidth2, headerRowY, leftCol + cellWidth1 + cellWidth2, headerRowY + cellHeight);
    doc.line(leftCol + cellWidth1 + cellWidth2 + cellWidth3, headerRowY, leftCol + cellWidth1 + cellWidth2 + cellWidth3, headerRowY + cellHeight);
    doc.line(leftCol + cellWidth1 + cellWidth2 + cellWidth3 + cellWidth4, headerRowY, leftCol + cellWidth1 + cellWidth2 + cellWidth3 + cellWidth4, headerRowY + cellHeight);

    // Add text in each cell - minimal vertical gap
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8); // Smaller font for compactness

    // PARTY cell
    doc.text('PARTY:', leftCol + 2, headerRowY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 43, 89); // #002b59 color
    doc.text((order.party?.name || '').toUpperCase(), leftCol + 15, headerRowY + 5);
    doc.setTextColor(0, 0, 0); // Reset to black

    // PO NO cell
    doc.setFont('helvetica', 'bold');
    doc.text('PO NO:', leftCol + cellWidth1 + 2, headerRowY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 43, 89); // #002b59 color
    doc.text((order.poNumber || '').toUpperCase(), leftCol + cellWidth1 + 18, headerRowY + 5);
    doc.setTextColor(0, 0, 0); // Reset to black

    // PO DATE cell
    doc.setFont('helvetica', 'bold');
    doc.text('PO DATE:', leftCol + cellWidth1 + cellWidth2 + 2, headerRowY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 43, 89); // #002b59 color
    doc.text((formatDate(order.poDate) || '').toUpperCase(), leftCol + cellWidth1 + cellWidth2 + 18, headerRowY + 5);
    doc.setTextColor(0, 0, 0); // Reset to black

    // DELIVERY DATE cell
    doc.setFont('helvetica', 'bold');
    doc.text('DELIVERY DATE:', leftCol + cellWidth1 + cellWidth2 + cellWidth3 + 2, headerRowY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 43, 89); // #002b59 color
    doc.text((formatDate(order.deliveryDate) || '').toUpperCase(), leftCol + cellWidth1 + cellWidth2 + cellWidth3 + 35, headerRowY + 5);
    doc.setTextColor(0, 0, 0); // Reset to black

    yPosition = headerRowY + cellHeight + 5; // Reduced spacing

    // Declare qualityFinishY outside the block for use in WASTAGE REPORT section
    let qualityFinishY = 220; // Default position if no items

    // Left and Right Boxes
    if (order.items.length > 0) {
      const firstItem = order.items[0];

      // Left Box with bordered fields - bigger for 50% space
      const fieldHeight = 8; // Compact field height
      const fieldWidth = 100; // Same width as right section for symmetry

      // QUALITY field with border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(leftCol, yPosition, fieldWidth, fieldHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('QUALITY:', leftCol + 2, yPosition + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 43, 89); // #002b59 color
      doc.text((firstItem.quality?.name || '').toUpperCase(), leftCol + 20, yPosition + 5);
      doc.setTextColor(0, 0, 0); // Reset to black
      yPosition += fieldHeight; // No gap - fields touch each other

      // FINISH Qty field with border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(leftCol, yPosition, fieldWidth, fieldHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('FINISH Qty:', leftCol + 2, yPosition + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 43, 89); // #002b59 color
      doc.text((firstItem.quantity?.toString() || '').toUpperCase(), leftCol + 25, yPosition + 5);
      doc.setTextColor(0, 0, 0); // Reset to black
      yPosition += fieldHeight; // No gap - fields touch each other

      // GREY QTY field with border - use grey information total quantity
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(leftCol, yPosition, fieldWidth, fieldHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('GREY QTY:', leftCol + 2, yPosition + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 43, 89); // #002b59 color
      // Use total quantity from grey information
      doc.text(greyInfoTotalQuantity.toString().toUpperCase(), leftCol + 25, yPosition + 5);
      doc.setTextColor(0, 0, 0); // Reset to black
      yPosition += fieldHeight; // Same gap as right side between groups

      // Second group: CUTTING, STYLE, DESIGN/CD Number in one big box
      const secondGroupStartY = yPosition;
      const secondGroupHeight = (fieldHeight * 2) + (fieldHeight * 7) + fieldHeight; // CUTTING + STYLE + 7-line gap + DESIGN/CD at bottom

      // Draw one big border for the second group
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(leftCol, secondGroupStartY, fieldWidth, secondGroupHeight);

      // CUTTING field (no individual border)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('CUTTING:', leftCol + 2, yPosition + 5);
      doc.setFont('helvetica', 'normal');
      doc.text('', leftCol + 25, yPosition + 5);
      yPosition += fieldHeight; // No gap - fields touch each other

      // STYLE field (no individual border)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0); // Black color for label
      doc.text('STYLE:', leftCol + 2, yPosition + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 43, 89); // Blue color (#002b59) for data
      const styleValue = order.styleNo ? order.styleNo.trim() : '';
      doc.text(styleValue.toUpperCase(), leftCol + 25, yPosition + 5);
      doc.setTextColor(0, 0, 0); // Reset to black
      yPosition += fieldHeight + (fieldHeight * 7); // Add 7 line gap after STYLE

      // DESIGN / CD Number field (no individual border) - positioned at bottom of box (last line)
      const designBottomY = secondGroupStartY + secondGroupHeight - fieldHeight; // Position at bottom
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('DESIGN / CD Number:', leftCol + 2, designBottomY + 5);
      doc.setFont('helvetica', 'normal');
      doc.text('', leftCol + 45, designBottomY + 5); // Moved further from border
      yPosition = secondGroupStartY + secondGroupHeight; // Update yPosition to end of box

      // Right Box - positioned to match left side, 50% space
      const rightBoxY = headerRowY + cellHeight + 5; // Match left side start position
      const rightFieldWidth = 100; // Field width for right side (matching left side width)

      // PURCHASE field with border - centered text
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(rightCol, rightBoxY, rightFieldWidth, fieldHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      // Center "PURCHASE" text
      const purchaseText = 'PURCHASE';
      const purchaseTextWidth = doc.getTextWidth(purchaseText);
      doc.text(purchaseText, rightCol + (rightFieldWidth - purchaseTextWidth) / 2, rightBoxY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 43, 89); // #002b59 color
      // Purchase amount will be calculated later after filtering (quality-wise)
      // Placeholder - will be updated after filteredMillOutputs is calculated
      doc.setTextColor(0, 0, 0); // Reset to black
      let rightY = rightBoxY + fieldHeight; // No gap - fields touch each other

      // WEAVER field with border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(rightCol, rightY, rightFieldWidth, fieldHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('WEAVER:', rightCol + 2, rightY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 43, 89); // #002b59 color
      doc.text((firstItem.weaverSupplierName || '').toUpperCase(), rightCol + 20, rightY + 5);
      doc.setTextColor(0, 0, 0); // Reset to black
      rightY += fieldHeight; // No gap - fields touch each other

      // ORDER QTY and RATE in one row - single field without vertical line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(rightCol, rightY, rightFieldWidth, fieldHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('ORDER QTY:', rightCol + 2, rightY + 5);
      doc.text('RATE', rightCol + 50, rightY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 43, 89); // #002b59 color
      doc.text((firstItem.quantity?.toString() || '').toUpperCase(), rightCol + 25, rightY + 5); // Real order quantity

      // Fix rate display - remove currency symbol and fix formatting
      const rateValue = firstItem.purchaseRate ? Math.round(firstItem.purchaseRate).toString() : '';
      doc.text(rateValue.toUpperCase(), rightCol + 60, rightY + 5); // Real purchase rate as clean number
      doc.setTextColor(0, 0, 0); // Reset to black

      rightY += fieldHeight; // No gap - fields touch each other

      // Main Table (Right side below the fields) - 50% space
      const tableStartY = rightY;
      const tableWidth = 100; // Table width (50% space)
      const tableRowHeight = 8; // Row height
      const colWidth = 23; // Column width (adjusted for bigger table)

      // Table header
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(rightCol, tableStartY, tableWidth, tableRowHeight);

      // Header text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('DATE', rightCol + 2, tableStartY + 5);
      doc.text('CH NO', rightCol + colWidth + 2, tableStartY + 5);
      doc.text('TAKA', rightCol + (colWidth * 2) + 2, tableStartY + 5);
      doc.text('MTR', rightCol + (colWidth * 3) + 2, tableStartY + 5);

      // Add vertical lines for columns
      doc.line(rightCol + colWidth, tableStartY, rightCol + colWidth, tableStartY + tableRowHeight);
      doc.line(rightCol + (colWidth * 2), tableStartY, rightCol + (colWidth * 2), tableStartY + tableRowHeight);
      doc.line(rightCol + (colWidth * 3), tableStartY, rightCol + (colWidth * 3), tableStartY + tableRowHeight);

      // Data rows with grey information data (quality-wise)
      let tableY = tableStartY + tableRowHeight;

      // Create entries from grey information data
      const greyInfoEntries: any[] = [];

      // Add grey information entries
      filteredGreyInfo.forEach((greyInfo, index) => {
        console.log(`PDF Generator - Processing grey info ${index}:`, greyInfo);

        if (!greyInfo) {
          console.log(`PDF Generator - Grey info ${index} is null/undefined`);
          return;
        }

        // Add entry from grey information
        const entry = {
          date: greyInfo.date || new Date(),
          chalanNo: greyInfo.chalanNo || '',
          numberOfPieces: Number(greyInfo.numberOfPieces) || 0, // TAKA column
          quantity: Number(greyInfo.quantity) || 0, // MTR column
          type: 'greyInfo'
        };

        console.log(`PDF Generator - Adding grey info entry:`, entry);
        greyInfoEntries.push(entry);
      });

      // Always show minimum 5 rows, but if more than 5 entries exist, show all dynamically
      const minRows = 5;
      const totalRowsToShow = Math.max(minRows, greyInfoEntries.length);
      const entriesToShow = greyInfoEntries;

      // If no grey info entries, log it
      if (entriesToShow.length === 0) {
        console.log('PDF Generator - No grey information entries found');
      }

      // Debug: Log all entries
      console.log('PDF Generator - Filtered Grey Info Entries:', entriesToShow);
      console.log('PDF Generator - Entries to Show:', entriesToShow.length);
      console.log('PDF Generator - Total Rows to Show:', totalRowsToShow);

      // Draw rows - minimum 5 rows, or all entries if more than 5
      for (let i = 0; i < totalRowsToShow; i++) {
        // Check if we need a new page (with margin for header and footer)
        if (tableY + tableRowHeight > pageHeight - 40) {
          doc.addPage();
          tableY = 8; // Reset to top of new page

          // Redraw table header on new page
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.3);
          doc.rect(rightCol, tableY, tableWidth, tableRowHeight);

          // Header text
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text('DATE', rightCol + 2, tableY + 5);
          doc.text('CH NO', rightCol + colWidth + 2, tableY + 5);
          doc.text('TAKA', rightCol + (colWidth * 2) + 2, tableY + 5);
          doc.text('MTR', rightCol + (colWidth * 3) + 2, tableY + 5);

          // Add vertical lines for columns
          doc.line(rightCol + colWidth, tableY, rightCol + colWidth, tableY + tableRowHeight);
          doc.line(rightCol + (colWidth * 2), tableY, rightCol + (colWidth * 2), tableY + tableRowHeight);
          doc.line(rightCol + (colWidth * 3), tableY, rightCol + (colWidth * 3), tableY + tableRowHeight);

          tableY += tableRowHeight;
        }

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(rightCol, tableY, tableWidth, tableRowHeight);

        // Check if we have data for this row
        if (i < entriesToShow.length) {
          const entry = entriesToShow[i];

          // Debug: Log each entry
          console.log(`PDF Generator - Entry ${i}:`, {
            date: entry.date,
            chalanNo: entry.chalanNo,
            numberOfPieces: entry.numberOfPieces,
            quantity: entry.quantity,
            type: entry.type
          });

          doc.setFont('helvetica', 'normal'); // Use normal font like other data
          doc.setFontSize(8); // Standard font size
          doc.setTextColor(0, 43, 89); // Use blue color like other data (#002b59)

          // DATE - Date from grey information
          const dateText = formatDate(entry.date).toUpperCase();
          console.log(`PDF Generator - Entry ${i} DATE:`, dateText);
          doc.text(dateText, rightCol + 2, tableY + 5);

          // CH NO - Chalan Number from grey information
          const chalanText = (entry.chalanNo || '').toUpperCase();
          console.log(`PDF Generator - Entry ${i} CHALAN:`, chalanText);
          doc.text(chalanText, rightCol + colWidth + 2, tableY + 5);

          // TAKA - Number of Pieces (numberOfPieces from grey information)
          const piecesText = (entry.numberOfPieces?.toString() || '0').toUpperCase();
          console.log(`PDF Generator - Entry ${i} PIECES:`, piecesText);
          doc.text(piecesText, rightCol + (colWidth * 2) + 2, tableY + 5);

          // MTR - Quantity (quantity from grey information)
          const metersText = (entry.quantity?.toString() || '0').toUpperCase();
          console.log(`PDF Generator - Entry ${i} METERS:`, metersText);
          doc.text(metersText, rightCol + (colWidth * 3) + 2, tableY + 5);

          doc.setTextColor(0, 0, 0); // Reset to black
        } else {
          // Empty row - show empty cells (for rows beyond available data but within minimum 5)
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text('', rightCol + 2, tableY + 5); // DATE
          doc.text('', rightCol + colWidth + 2, tableY + 5); // CH NO
          doc.text('', rightCol + (colWidth * 2) + 2, tableY + 5); // TAKA
          doc.text('', rightCol + (colWidth * 3) + 2, tableY + 5); // MTR
        }

        // Add vertical lines for columns
        doc.line(rightCol + colWidth, tableY, rightCol + colWidth, tableY + tableRowHeight);
        doc.line(rightCol + (colWidth * 2), tableY, rightCol + (colWidth * 2), tableY + tableRowHeight);
        doc.line(rightCol + (colWidth * 3), tableY, rightCol + (colWidth * 3), tableY + tableRowHeight);

        tableY += tableRowHeight;
      }

      // Move outside table structure for TOTAL and GREY REPORT
      // No gap - TOTAL row touches table directly

      // TOTAL row - with border and selective vertical lines
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(rightCol, tableY, tableWidth, tableRowHeight); // Full border
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('TOTAL:', rightCol + 2, tableY + 5);
      doc.setTextColor(0, 43, 89); // #002b59 color

      // Use pre-calculated totals from grey information
      // CH NO column - empty in total row
      doc.text('', rightCol + colWidth + 2, tableY + 5);
      // TAKA column - total pieces from grey information
      doc.text(greyInfoTotalPieces.toString().toUpperCase(), rightCol + (colWidth * 2) + 2, tableY + 5);
      // MTR column - total quantity from grey information
      doc.text(greyInfoTotalQuantity.toString().toUpperCase(), rightCol + (colWidth * 3) + 2, tableY + 5);
      doc.setTextColor(0, 0, 0); // Reset to black

      // Add vertical lines: after CH NO and after TAKA (no line before CH NO)
      doc.line(rightCol + (colWidth * 2), tableY, rightCol + (colWidth * 2), tableY + tableRowHeight); // After CH NO
      doc.line(rightCol + (colWidth * 3), tableY, rightCol + (colWidth * 3), tableY + tableRowHeight); // After TAKA

      tableY += tableRowHeight; // No gap - fields touch each other

      // GREY REPORT section - single bordered box with "L:" and "GREY REPORT:" labels only
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(rightCol, tableY, tableWidth, tableRowHeight * 3); // Taller box for header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('L:', rightCol + tableWidth - 74, tableY + 5); // L: on right side
      doc.text('GREY REPORT:', rightCol + 2, tableY + 9); // GREY REPORT on left side

      // GREY REPORT section - no data table, just empty space

      tableY += tableRowHeight * 3 + 4; // Space after GREY REPORT

      // Create professional table structure - align with both left and right sections
      // Use the maximum Y position from both sides to ensure horizontal alignment
      const maxYPosition = Math.max(yPosition, tableY);
      const professionalTableStartY = maxYPosition;
      const fullTableWidth = pageWidth - 10; // Bigger width to match other elements
      const section1Width = fullTableWidth * 0.30; // ISSUE TO MILL - 30%
      const section2Width = fullTableWidth * 0.40; // REC FROM MILL - 40%
      const section3Width = fullTableWidth * 0.30; // SALES - 30%
      const rowHeight = 10; // Compact row height

      // First row - Main headers with borders
      const headerRowHeight = 12; // Increased height to accommodate two-line headers

      // Draw border around header row - positioned to match other elements
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(5, professionalTableStartY, fullTableWidth, headerRowHeight);

      // Draw vertical dividers for header columns
      doc.line(5 + section1Width, professionalTableStartY, 5 + section1Width, professionalTableStartY + headerRowHeight);
      doc.line(5 + section1Width + section2Width, professionalTableStartY, 5 + section1Width + section2Width, professionalTableStartY + headerRowHeight);

      // Add header text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);

      // ISSUE TO MILL header - centered
      doc.text('ISSUE TO MILL', 5 + section1Width / 2, professionalTableStartY + 5, { align: 'center' });

      // REC FROM MILL header with Mill Rate
      doc.text('REC FROM MILL:', 5 + section1Width + 5, professionalTableStartY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 43, 89); // #002b59 color
      // Show mill rate from order items (millRate field) - the actual field from order form
      const millRate = order.items?.[0]?.millRate || 0;
      console.log('PDF Generator - Mill Rate Debug:', {
        orderItems: order.items,
        firstItem: order.items?.[0],
        millRateFromItem: order.items?.[0]?.millRate,
        finalMillRate: millRate
      });
      doc.text(`${millRate}`, 5 + section1Width + 35, professionalTableStartY + 5);
      doc.setTextColor(0, 0, 0); // Reset to black
      doc.setFont('helvetica', 'bold');

      // SALES header with Sales Rate
      doc.text('SALES:', 5 + section1Width + section2Width + 5, professionalTableStartY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 43, 89); // #002b59 color
      // Show sales rate from order items (salesRate field) - the actual field from order form
      const salesRate = order.items?.[0]?.salesRate || 0;
      console.log('PDF Generator - Sales Rate Debug:', {
        orderItems: order.items,
        firstItem: order.items?.[0],
        salesRateFromItem: order.items?.[0]?.salesRate,
        finalSalesRate: salesRate
      });
      doc.text(`${salesRate}`, 5 + section1Width + section2Width + 25, professionalTableStartY + 5);
      doc.setTextColor(0, 0, 0); // Reset to black
      doc.setFont('helvetica', 'bold');

      tableY = professionalTableStartY + headerRowHeight + 0;

      // Note: Table border will be drawn dynamically as rows are added
      // We'll track the actual table height as we add rows

      // Second row - Sub headers and MILL field
      const headerY = tableY + 4;
      doc.setFontSize(8);

      // ISSUE TO MILL - MILL field with more padding
      doc.text('MILL:', 8, headerY - 1);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 43, 89); // #002b59 color
      // Show first mill name if available
      const firstMill = order.millInputs?.[0]?.mill?.name || '';
      doc.text(firstMill.toUpperCase(), 20, headerY - 1);
      doc.setTextColor(0, 0, 0); // Reset to black

      // ISSUE TO MILL table structure - DATE, CH NO, TAKA, MTR as column headers
      const issueDateWidth = section1Width * 0.25; // 25%
      const issueCnoWidth = section1Width * 0.25; // 25%
      const issueTakaWidth = section1Width * 0.25; // 25%
      const issueMtrWidth = section1Width * 0.25; // 25%

      // ISSUE TO MILL column headers - integrated with main table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('DATE', 8, headerY + 5);
      doc.text('C.NO', 8 + issueDateWidth, headerY + 5);
      doc.text('TAKA', 8 + issueDateWidth + issueCnoWidth, headerY + 5);
      doc.text('MTR', 8 + issueDateWidth + issueCnoWidth + issueTakaWidth, headerY + 5);

      // Add table borders for ISSUE TO MILL section
      const issueTableStartX = 5;
      const issueTableStartY = headerY;
      const issueTableWidth = section1Width;
      const issueTableHeight = 20;

      // Draw main table border


      // Add vertical lines between columns
      doc.setLineWidth(0.3);
      doc.line(issueTableStartX + issueDateWidth, issueTableStartY, issueTableStartX + issueDateWidth, issueTableStartY + issueTableHeight);
      doc.line(issueTableStartX + issueDateWidth + issueCnoWidth, issueTableStartY, issueTableStartX + issueDateWidth + issueCnoWidth, issueTableStartY + issueTableHeight);
      doc.line(issueTableStartX + issueDateWidth + issueCnoWidth + issueTakaWidth, issueTableStartY, issueTableStartX + issueDateWidth + issueCnoWidth + issueTakaWidth, issueTableStartY + issueTableHeight);

      // Add top horizontal border only
      doc.line(issueTableStartX, issueTableStartY, issueTableStartX + issueTableWidth, issueTableStartY);

      // Note: Horizontal lines between rows are handled in the main table loop below

      // REC FROM MILL columns - percentage-based spacing for 40% width (removed L.T NO and G.MT)
      const dateWidth = section2Width * 0.30; // 30% (increased from 20%)
      const chNoWidth = section2Width * 0.30; // 30% (increased from 15%)
      const fmtWidth = section2Width * 0.25; // 25% (increased from 20%)
      const shtWidth = section2Width * 0.15; // 15% (increased from 10%)

      doc.setFont('helvetica', 'bold');
      doc.text('DATE', 8 + section1Width, headerY);
      doc.text('CH', 8 + section1Width + dateWidth, headerY);
      doc.text('NO', 8 + section1Width + dateWidth, headerY + 4);
      doc.text('F.MT', 8 + section1Width + dateWidth + chNoWidth, headerY);
      doc.text('SH', 8 + section1Width + dateWidth + chNoWidth + fmtWidth, headerY);
      doc.text('T', 8 + section1Width + dateWidth + chNoWidth + fmtWidth, headerY + 4);

      // SALES columns - removed TRANS and LR
      const salesDateWidth = section3Width * 0.25; // 25%
      const salesBillWidth = section3Width * 0.20; // 20%
      const salesParcelWidth = section3Width * 0.20; // 20%
      const salesMtrWidth = section3Width * 0.35; // 35%

      doc.setFontSize(7); // Smaller font to fit more columns
      doc.text('DATE', 8 + section1Width + section2Width, headerY);
      doc.text('BILL', 8 + section1Width + section2Width + salesDateWidth, headerY);
      doc.text('PAR', 8 + section1Width + section2Width + salesDateWidth + salesBillWidth, headerY);
      doc.text('CEL', 8 + section1Width + section2Width + salesDateWidth + salesBillWidth, headerY + 4);
      doc.text('MTR', 8 + section1Width + section2Width + salesDateWidth + salesBillWidth + salesParcelWidth, headerY);
      doc.setFontSize(8); // Reset font size

      // Add horizontal line after all column headers
      doc.line(5, headerY + 8, 5 + fullTableWidth, headerY + 8);

      // Create mill input entries filtered by quality for ISSUE TO MILL section
      const allMillInputEntries: any[] = [];

      // Filter mill inputs by quality - only show data for selected quality
      const filteredMillInputs = order.millInputs?.filter((millInput) => {
        if (!qualityId || !millInput.quality) return false;
        const millQualityId = typeof millInput.quality === 'object'
          ? (millInput.quality as any)._id || millInput.quality
          : millInput.quality;
        const matches = String(millQualityId) === String(qualityId);
        return matches;
      }) || [];

      console.log('PDF Generator - Filtered Mill Inputs:', {
        total: order.millInputs?.length || 0,
        filtered: filteredMillInputs.length,
        qualityId: qualityId
      });

      // Add main mill input entries filtered by quality
      filteredMillInputs.forEach((millInput) => {
        if (!millInput) return;

        // Add main entry (already filtered by quality)
        const mainEntry = {
          date: millInput.millDate || new Date(),
          chalanNo: millInput.chalanNo || '',
          greighMtr: Number(millInput.greighMtr) || 0,
          pcs: Number(millInput.pcs) || 0,
          type: 'main'
        };
        allMillInputEntries.push(mainEntry);

        // Add additional meter entries - also filter by quality if they have quality field
        if (millInput.additionalMeters && Array.isArray(millInput.additionalMeters)) {
          millInput.additionalMeters.forEach((additional) => {
            if (!additional) return;

            // If additional meter has quality field, check if it matches selected quality
            // If no quality field, include it (inherits from parent mill input)
            if (additional.quality) {
              const additionalQualityId = typeof additional.quality === 'object'
                ? (additional.quality as any)._id || additional.quality
                : additional.quality;
              // Only include if quality matches selected quality
              if (String(additionalQualityId) !== String(qualityId)) {
                return; // Skip this additional meter - different quality
              }
            }

            const additionalEntry = {
              date: millInput.millDate || new Date(),
              chalanNo: millInput.chalanNo || '',
              greighMtr: Number(additional.greighMtr) || 0,
              pcs: Number(additional.pcs) || 0,
              type: 'additional'
            };
            allMillInputEntries.push(additionalEntry);
          });
        }
      });

      // Filter mill outputs by quality - only show data for selected quality
      filteredMillOutputs = order.millOutputs?.filter((millOutput) => {
        if (!qualityId || !millOutput.quality) return false;
        const outputQualityId = typeof millOutput.quality === 'object'
          ? (millOutput.quality as any)._id || millOutput.quality
          : millOutput.quality;
        return String(outputQualityId) === String(qualityId);
      }) || [];

      console.log('PDF Generator - Filtered Mill Outputs:', {
        total: order.millOutputs?.length || 0,
        filtered: filteredMillOutputs.length,
        qualityId: qualityId
      });

      // Filter dispatches by quality - only show data for selected quality
      filteredDispatches = order.dispatches?.filter((dispatch) => {
        if (!qualityId || !dispatch.quality) return false;
        const dispatchQualityId = typeof dispatch.quality === 'object'
          ? (dispatch.quality as any)._id || dispatch.quality
          : dispatch.quality;
        return String(dispatchQualityId) === String(qualityId);
      }) || [];

      console.log('PDF Generator - Filtered Dispatches:', {
        total: order.dispatches?.length || 0,
        filtered: filteredDispatches.length,
        qualityId: qualityId
      });

      // Calculate maximum rows needed across all sections
      // Always show minimum 5 rows, but if more than 5 entries exist, show all dynamically
      const minRowsForTable = 5;
      const actualMaxRows = Math.max(
        allMillInputEntries.length,
        filteredMillOutputs.length,
        filteredDispatches.length
      );
      const maxRows = Math.max(minRowsForTable, actualMaxRows);

      const dataRowHeight = 8; // Height of each row
      let currentDataRowY = headerY + 8; // Start after the horizontal line
      let currentPageTableY = tableY; // Track table start Y for current page

      // Draw data rows - minimum 5 rows, or all entries if more than 5
      for (let i = 0; i < maxRows; i++) {
        // Check if we need a new page (with margin for header, footer, and TOTAL row)
        if (currentDataRowY + dataRowHeight * 2 > pageHeight - 40) {
          // Add new page
          doc.addPage();

          // Reset position for new page
          const newPageStartY = 8;
          currentDataRowY = newPageStartY;

          // Update tableY for new page (needed for border drawing)
          tableY = newPageStartY + headerRowHeight;
          currentPageTableY = tableY; // Update current page table start

          // Redraw headers on new page
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.3);

          // Main header row
          const newHeaderRowY = newPageStartY;
          doc.rect(5, newHeaderRowY, fullTableWidth, headerRowHeight);
          doc.line(5 + section1Width, newHeaderRowY, 5 + section1Width, newHeaderRowY + headerRowHeight);
          doc.line(5 + section1Width + section2Width, newHeaderRowY, 5 + section1Width + section2Width, newHeaderRowY + headerRowHeight);

          // Header text
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text('ISSUE TO MILL', 5 + section1Width / 2, newHeaderRowY + 5, { align: 'center' });
          doc.text('REC FROM MILL:', 5 + section1Width + 5, newHeaderRowY + 5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 43, 89);
          doc.text(`${millRate}`, 5 + section1Width + 35, newHeaderRowY + 5);
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'bold');
          doc.text('SALES:', 5 + section1Width + section2Width + 5, newHeaderRowY + 5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 43, 89);
          doc.text(`${salesRate}`, 5 + section1Width + section2Width + 25, newHeaderRowY + 5);
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'bold');

          // Sub headers
          const newHeaderY = newHeaderRowY + headerRowHeight + 4;
          doc.setFontSize(8);
          doc.text('MILL:', 8, newHeaderY - 1);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 43, 89);
          doc.text(firstMill.toUpperCase(), 20, newHeaderY - 1);
          doc.setTextColor(0, 0, 0);

          // Column headers
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text('DATE', 8, newHeaderY + 5);
          doc.text('C.NO', 8 + issueDateWidth, newHeaderY + 5);
          doc.text('TAKA', 8 + issueDateWidth + issueCnoWidth, newHeaderY + 5);
          doc.text('MTR', 8 + issueDateWidth + issueCnoWidth + issueTakaWidth, newHeaderY + 5);

          doc.text('DATE', 8 + section1Width, newHeaderY);
          doc.text('CH', 8 + section1Width + dateWidth, newHeaderY);
          doc.text('NO', 8 + section1Width + dateWidth, newHeaderY + 4);
          doc.text('F.MT', 8 + section1Width + dateWidth + chNoWidth, newHeaderY);
          doc.text('SH', 8 + section1Width + dateWidth + chNoWidth + fmtWidth, newHeaderY);
          doc.text('T', 8 + section1Width + dateWidth + chNoWidth + fmtWidth, newHeaderY + 4);

          doc.setFontSize(7);
          doc.text('DATE', 8 + section1Width + section2Width, newHeaderY);
          doc.text('BILL', 8 + section1Width + section2Width + salesDateWidth, newHeaderY);
          doc.text('PAR', 8 + section1Width + section2Width + salesDateWidth + salesBillWidth, newHeaderY);
          doc.text('CEL', 8 + section1Width + section2Width + salesDateWidth + salesBillWidth, newHeaderY + 4);
          doc.text('MTR', 8 + section1Width + section2Width + salesDateWidth + salesBillWidth + salesParcelWidth, newHeaderY);
          doc.setFontSize(8);

          // Horizontal line after headers
          doc.line(5, newHeaderY + 8, 5 + fullTableWidth, newHeaderY + 8);

          // Draw left border, right border, and section dividers for new page
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.3);
          doc.line(5, newHeaderRowY, 5, newHeaderY + 8); // Left border start
          doc.line(5 + fullTableWidth, newHeaderRowY, 5 + fullTableWidth, newHeaderY + 8); // Right border start
          doc.line(5 + section1Width, newHeaderRowY, 5 + section1Width, newHeaderY + 8); // Section divider 1
          doc.line(5 + section1Width + section2Width, newHeaderRowY, 5 + section1Width + section2Width, newHeaderY + 8); // Section divider 2

          // Update currentDataRowY to start after headers
          currentDataRowY = newHeaderY + 8;
        }

        currentDataRowY += dataRowHeight;

        // Draw horizontal line for this row
        doc.line(5, currentDataRowY, 5 + fullTableWidth, currentDataRowY);

        // Add real data to each row
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(0, 43, 89); // #002b59 color

        // ISSUE TO MILL section data - show mill input data filtered by quality
        if (i < allMillInputEntries.length) {
          const entry = allMillInputEntries[i];
          if (entry) {
            // DATE - Mill Date
            doc.text(formatDate(entry.date).toUpperCase(), 8, currentDataRowY - 3);
            // C.NO - Chalan Number
            doc.text((entry.chalanNo || '').toUpperCase(), 8 + issueDateWidth, currentDataRowY - 3);
            // TAKA - Number of Pieces (from pcs field)
            doc.text((Number(entry.pcs) || 0).toString().toUpperCase(), 8 + issueDateWidth + issueCnoWidth, currentDataRowY - 3);
            // MTR - Greigh Meters (actual meters value)
            doc.text((Number(entry.greighMtr) || 0).toString().toUpperCase(), 8 + issueDateWidth + issueCnoWidth + issueTakaWidth, currentDataRowY - 3);
          }
        } else {
          // Empty row for ISSUE TO MILL section (if beyond available data but within minimum 5)
          doc.text('', 8, currentDataRowY - 3); // DATE
          doc.text('', 8 + issueDateWidth, currentDataRowY - 3); // C.NO
          doc.text('', 8 + issueDateWidth + issueCnoWidth, currentDataRowY - 3); // TAKA
          doc.text('', 8 + issueDateWidth + issueCnoWidth + issueTakaWidth, currentDataRowY - 3); // MTR
        }

        // REC FROM MILL section data - filtered by quality
        if (i < filteredMillOutputs.length) {
          const millOutput = filteredMillOutputs[i];
          if (millOutput) {
            // DATE - Received Date (recdDate)
            doc.text(formatDate(millOutput.recdDate), 8 + section1Width, currentDataRowY - 3);
            // CH NO - Mill Bill Number (millBillNo)
            doc.text(millOutput.millBillNo || '', 8 + section1Width + dateWidth, currentDataRowY - 3);
            // F.MT - Finished Meters (finishedMtr)
            doc.text((Number(millOutput.finishedMtr) || 0).toString(), 8 + section1Width + dateWidth + chNoWidth, currentDataRowY - 3);

            // SHT - Leave empty for individual rows, only show percentage in TOTAL row
            doc.text('', 8 + section1Width + dateWidth + chNoWidth + fmtWidth, currentDataRowY - 3);
          }
        } else {
          // Empty row for REC FROM MILL section (if beyond available data but within minimum 5)
          doc.text('', 8 + section1Width, currentDataRowY - 3); // DATE
          doc.text('', 8 + section1Width + dateWidth, currentDataRowY - 3); // CH NO
          doc.text('', 8 + section1Width + dateWidth + chNoWidth, currentDataRowY - 3); // F.MT
          doc.text('', 8 + section1Width + dateWidth + chNoWidth + fmtWidth, currentDataRowY - 3); // SHT
        }

        // SALES section data - filtered by quality
        if (i < filteredDispatches.length) {
          const dispatch = filteredDispatches[i];
          if (dispatch) {
            doc.setFontSize(7); // Smaller font to fit more columns
            // DATE - Dispatch Date
            doc.text(formatDate(dispatch.dispatchDate), 8 + section1Width + section2Width, currentDataRowY - 3);
            // BILL - Bill Number (show actual bill number)
            doc.text(dispatch.billNo || '0', 8 + section1Width + section2Width + salesDateWidth, currentDataRowY - 3);
            // PARCEL - Parcel/Consignment number (show clean 0)
            doc.text('0', 8 + section1Width + section2Width + salesDateWidth + salesBillWidth, currentDataRowY - 3);
            // MTR - Dispatch Meters (Finish Meters)
            doc.text((Number(dispatch.finishMtr) || 0).toString(), 8 + section1Width + section2Width + salesDateWidth + salesBillWidth + salesParcelWidth, currentDataRowY - 3);
            doc.setFontSize(7); // Keep small font for data rows
          }
        } else {
          // Empty row for SALES section (if beyond available data but within minimum 5)
          doc.setFontSize(7); // Smaller font to fit more columns
          doc.text('', 8 + section1Width + section2Width, currentDataRowY - 3); // DATE
          doc.text('', 8 + section1Width + section2Width + salesDateWidth, currentDataRowY - 3); // BILL
          doc.text('', 8 + section1Width + section2Width + salesDateWidth + salesBillWidth, currentDataRowY - 3); // PARCEL
          doc.text('', 8 + section1Width + section2Width + salesDateWidth + salesBillWidth + salesParcelWidth, currentDataRowY - 3); // MTR
          doc.setFontSize(7); // Keep small font for data rows
        }

        doc.setTextColor(0, 0, 0); // Reset to black

        // Add vertical borders for each section in this row
        // ISSUE TO MILL section vertical borders
        doc.line(5 + issueDateWidth, currentDataRowY - dataRowHeight, 5 + issueDateWidth, currentDataRowY);
        doc.line(5 + issueDateWidth + issueCnoWidth, currentDataRowY - dataRowHeight, 5 + issueDateWidth + issueCnoWidth, currentDataRowY);
        doc.line(5 + issueDateWidth + issueCnoWidth + issueTakaWidth, currentDataRowY - dataRowHeight, 5 + issueDateWidth + issueCnoWidth + issueTakaWidth, currentDataRowY);

        // REC FROM MILL section - no vertical lines after TOTAL

        // SALES section vertical borders (removed TRANS and LR)
        doc.line(5 + section1Width + section2Width + salesDateWidth, currentDataRowY - dataRowHeight, 5 + section1Width + section2Width + salesDateWidth, currentDataRowY);
        doc.line(5 + section1Width + section2Width + salesDateWidth + salesBillWidth, currentDataRowY - dataRowHeight, 5 + section1Width + section2Width + salesDateWidth + salesBillWidth, currentDataRowY);
        doc.line(5 + section1Width + section2Width + salesDateWidth + salesBillWidth + salesParcelWidth, currentDataRowY - dataRowHeight, 5 + section1Width + section2Width + salesDateWidth + salesBillWidth + salesParcelWidth, currentDataRowY);
      }

      // Add TOTAL row
      // Check if we need a new page for TOTAL row
      if (currentDataRowY + dataRowHeight * 2 > pageHeight - 40) {
        doc.addPage();
        currentDataRowY = 8;
      }

      currentDataRowY += dataRowHeight;
      doc.line(5, currentDataRowY, 5 + fullTableWidth, currentDataRowY);

      // Calculate totals from filtered mill input data (quality-wise)
      const filteredMillInputTotalPcs = allMillInputEntries.reduce((total, entry) => {
        return total + (entry.pcs || 0);
      }, 0);

      const filteredMillInputTotalMtr = allMillInputEntries.reduce((total, entry) => {
        return total + (entry.greighMtr || 0);
      }, 0);

      // Calculate totals from filtered mill outputs (quality-wise)
      const filteredMillOutputTotalFmt = filteredMillOutputs.reduce((total, output) => {
        return total + (Number(output.finishedMtr) || 0);
      }, 0);

      // Calculate filtered mill cost for PURCHASE field (quality-wise)
      const filteredMillCost = filteredMillOutputs.reduce((total, output) => {
        return total + ((Number(output.finishedMtr) || 0) * (Number(output.millRate) || 0));
      }, 0);

      // Update PURCHASE field with filtered amount (quality-wise)
      if (filteredMillCost > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(0, 43, 89); // #002b59 color
        const purchaseAmount = filteredMillCost % 1 === 0 ? filteredMillCost.toString() : filteredMillCost.toFixed(2);
        // Purchase field position (rightCol + 25, rightBoxY + 5)
        const purchaseFieldX = rightCol + 25;
        const purchaseFieldY = rightBoxY + 5;
        // Clear the area first (draw white rectangle to overwrite)
        doc.setFillColor(255, 255, 255);
        doc.rect(purchaseFieldX - 2, purchaseFieldY - 3, 30, 4, 'F');
        // Draw the filtered purchase amount
        doc.text(`₹${purchaseAmount}`.toUpperCase(), purchaseFieldX, purchaseFieldY);
        doc.setTextColor(0, 0, 0); // Reset to black
      }

      // Calculate totals from filtered dispatches (quality-wise)
      const filteredDispatchBillCount = filteredDispatches.length;
      const filteredDispatchTotalMtr = filteredDispatches.reduce((total, dispatch) => {
        return total + (Number(dispatch.finishMtr) || 0);
      }, 0);

      // Add TOTAL text in all three sections with real calculated totals
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 43, 89); // #002b59 color

      // TOTAL in ISSUE TO MILL section - use mill input totals (filtered by quality)
      doc.text('TOTAL:', 8, currentDataRowY - 3);
      // TAKA total - total pieces from mill inputs
      doc.text(filteredMillInputTotalPcs.toString().toUpperCase(), 8 + issueDateWidth + issueCnoWidth, currentDataRowY - 3);
      // MTR total - total greigh meters from mill inputs
      doc.text(filteredMillInputTotalMtr.toString().toUpperCase(), 8 + issueDateWidth + issueCnoWidth + issueTakaWidth, currentDataRowY - 3);

      // Add vertical lines for TAKA and MTR columns in ISSUE TO MILL section
      doc.line(5 + issueDateWidth + issueCnoWidth, currentDataRowY - dataRowHeight, 5 + issueDateWidth + issueCnoWidth, currentDataRowY);
      doc.line(5 + issueDateWidth + issueCnoWidth + issueTakaWidth, currentDataRowY - dataRowHeight, 5 + issueDateWidth + issueCnoWidth + issueTakaWidth, currentDataRowY);

      // TOTAL in REC FROM MILL section - use filtered mill output totals
      doc.text('TOTAL:', 8 + section1Width, currentDataRowY - 3);
      // F.MT total - total finished meters from filtered outputs
      doc.text(filteredMillOutputTotalFmt.toString().toUpperCase(), 8 + section1Width + dateWidth + chNoWidth, currentDataRowY - 3);

      // SHT total - Show percentage (manual calculation: MTR - F.MT = difference, then show as %)
      // Use mill input total for MTR
      const mtrTotal = filteredMillInputTotalMtr; // Use mill input total
      const fmtTotal = filteredMillOutputTotalFmt;
      const totalDifference = mtrTotal - fmtTotal;
      const totalPercentage = mtrTotal > 0 ? ((totalDifference / mtrTotal) * 100) : 0;
      doc.text(`${totalPercentage.toFixed(1)}%`, 8 + section1Width + dateWidth + chNoWidth + fmtWidth, currentDataRowY - 3);

      // TOTAL in SALES section - use filtered dispatch totals
      doc.setFontSize(8); // Reset to normal font for totals
      doc.text('TOTAL:', 8 + section1Width + section2Width, currentDataRowY - 3);
      // BILL total - empty in total row
      doc.text('', 8 + section1Width + section2Width + salesDateWidth, currentDataRowY - 3);
      // PARCEL total - show clean 0
      doc.text('0', 8 + section1Width + section2Width + salesDateWidth + salesBillWidth, currentDataRowY - 3);
      // MTR total - total dispatch meters from filtered dispatches
      doc.text(filteredDispatchTotalMtr.toString().toUpperCase(), 8 + section1Width + section2Width + salesDateWidth + salesBillWidth + salesParcelWidth, currentDataRowY - 3);

      doc.setTextColor(0, 0, 0); // Reset to black

      // Add internal vertical borders for each section
      // ISSUE TO MILL section - separate table created above with proper borders

      // REC FROM MILL section internal borders - percentage-based spacing (removed L.T NO and G.MT columns)
      // Line after DATE - stop before TOTAL row (no line after DATE in TOTAL row)
      const totalRowStartY = currentDataRowY - dataRowHeight; // TOTAL row starts here
      // Use the original tableY (first page) for border calculations
      // Note: For multi-page tables, borders are drawn per page as rows are added
      doc.line(5 + section1Width + dateWidth, currentPageTableY, 5 + section1Width + dateWidth, totalRowStartY);
      // Line after CH NO - full height including TOTAL row
      doc.line(5 + section1Width + dateWidth + chNoWidth, currentPageTableY, 5 + section1Width + dateWidth + chNoWidth, currentDataRowY);
      // Line after F.MT - full height including TOTAL row
      doc.line(5 + section1Width + dateWidth + chNoWidth + fmtWidth, currentPageTableY, 5 + section1Width + dateWidth + chNoWidth + fmtWidth, currentDataRowY);

      // SALES section internal borders - percentage-based spacing (removed TRANS and LR)
      // Line after DATE - stop before TOTAL row (no line after DATE in TOTAL row)
      doc.line(5 + section1Width + section2Width + salesDateWidth, currentPageTableY, 5 + section1Width + section2Width + salesDateWidth, totalRowStartY);
      // Line after BILL - full height including TOTAL row
      doc.line(5 + section1Width + section2Width + salesDateWidth + salesBillWidth, currentPageTableY, 5 + section1Width + section2Width + salesDateWidth + salesBillWidth, currentDataRowY);
      // Line after PARCEL - full height including TOTAL row
      doc.line(5 + section1Width + section2Width + salesDateWidth + salesBillWidth + salesParcelWidth, currentPageTableY, 5 + section1Width + section2Width + salesDateWidth + salesBillWidth + salesParcelWidth, currentDataRowY);

      // Draw main table border and vertical section dividers dynamically
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      // Draw left border (from first page table start to current end)
      doc.line(5, currentPageTableY, 5, currentDataRowY);
      // Draw right border
      doc.line(5 + fullTableWidth, currentPageTableY, 5 + fullTableWidth, currentDataRowY);
      // Draw vertical section dividers
      doc.line(5 + section1Width, currentPageTableY, 5 + section1Width, currentDataRowY);
      doc.line(5 + section1Width + section2Width, currentPageTableY, 5 + section1Width + section2Width, currentDataRowY);

      // No data rows - just the table structure with headers

      // Quality & Finish Items section removed - position WASTAGE REPORT directly after sales table
      qualityFinishY = currentDataRowY + 5; // Reduced gap - position below the main table (after TOTAL row)
    }

    // Add WASTAGE REPORT and FINAL REPORT sections
    let reportStartY = qualityFinishY; // Position below Quality & Finish Items table or default position

    // Check if we need a new page for WASTAGE REPORT and FINAL REPORT sections
    const reportBoxHeight = 40; // Increased height for more space
    // Use minimal margin (5mm) to maximize use of first page
    // Only break if content would actually overflow
    if (reportStartY + reportBoxHeight > pageHeight - 5) {
      doc.addPage();
      reportStartY = 8; // Reset to top of new page
    }

    const reportBoxWidth = (pageWidth - 10) / 2; // Half width for each box to fit properly

    // WASTAGE REPORT section (left side)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(5, reportStartY, reportBoxWidth, reportBoxHeight);

    // WASTAGE REPORT header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('WASTAGE REPORT:', 8, reportStartY + 6);

    // First horizontal line after header
    doc.line(5, reportStartY + 8, 5 + reportBoxWidth, reportStartY + 8);

    // CHINDI field
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('CHINDI:', 8, reportStartY + 12);

    // Second horizontal line after CHINDI
    doc.line(5, reportStartY + 14, 5 + reportBoxWidth, reportStartY + 14);

    // CUT PIC field
    doc.setFont('helvetica', 'bold');
    doc.text('CUT PIC:', 8, reportStartY + 18);

    // Third horizontal line after CUT PIC
    doc.line(5, reportStartY + 20, 5 + reportBoxWidth, reportStartY + 20);

    // Just free space - no extra lines

    // FINAL REPORT section (right side) - no gap between sections
    const finalReportX = 5 + reportBoxWidth; // No gap - sections touch each other
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(finalReportX, reportStartY, reportBoxWidth, reportBoxHeight);

    // FINAL REPORT header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('FINAL REPORT:', finalReportX + 3, reportStartY + 6);

    // Add calculations to FINAL REPORT
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 43, 89); // #002b59 color

    // Calculate PUR = (Rate × Mtr) × 1.05 (Rate × Mtr with 5% GST)
    // Get total MTr from purchase table (grey information, quality-filtered)
    const mtrTotal = greyInfoTotalQuantity; // Total MTr from purchase table
    // Get rate from purchase table/order items
    const purchaseRate = order.items?.[0]?.purchaseRate || 0;
    // Calculate PUR = (rate × mtr) × 1.05
    const purValue = (purchaseRate * mtrTotal) * 1.05;

    // Calculate MILL = Total F.MT × Mill Rate + 5%
    // Use filtered mill outputs total (quality-wise)
    const totalFmt = filteredMillOutputs.reduce((total, output) => total + (Number(output.finishedMtr) || 0), 0);
    const millRate = order.items?.[0]?.millRate || 0;
    const millValue = (millRate * totalFmt) * 1.05; // rate * mtr + 5%

    // Calculate SALE = Total MTR from SALES table × Sales Rate + 5%
    // Use filtered dispatches total (quality-wise)
    const salesMtrTotal = filteredDispatches.reduce((total, dispatch) => total + (Number(dispatch.finishMtr) || 0), 0);
    const salesRate = order.items?.[0]?.salesRate || 0;
    const saleValue = (salesMtrTotal * salesRate) * 1.05; // +5%

    // Display the calculated values
    doc.text(`PUR-${Math.round(purValue)}`, finalReportX + 3, reportStartY + 12);
    doc.text(`MILL-${Math.round(millValue)}`, finalReportX + 3, reportStartY + 18);
    doc.text(`SALE-${Math.round(saleValue)}`, finalReportX + 3, reportStartY + 24);

    doc.setTextColor(0, 0, 0); // Reset to black

    // Bottom section - Table with Dispatch Date, Bill Number, Transport, LR No
    let bottomSectionStartY = reportStartY + reportBoxHeight + 5; // Position below report sections

    // IMPORTANT: Filter by quality first, then group dispatches by unique combination of (date, billNo, transport, lrNo)
    // If Dispatch Item 1 has m1, m2, m3 finish meters with same date/bill/transport/LR,
    // they will be shown as ONE row (not 3 separate rows)
    // Only when you add a NEW dispatch item (different date/bill/transport/LR) will it show as a new row
    const allDispatches = order.dispatches || [];

    // First, filter dispatches by quality (quality-wise filtering)
    const qualityFilteredDispatches = allDispatches.filter((dispatch) => {
      if (!qualityId || !dispatch.quality) return false;
      const dispatchQualityId = typeof dispatch.quality === 'object'
        ? (dispatch.quality as any)._id || dispatch.quality
        : dispatch.quality;
      return String(dispatchQualityId) === String(qualityId);
    });

    // Then, group quality-filtered dispatches by unique combination of date, billNo, transportNo, lrNo
    // Use a Map to track unique combinations
    const uniqueDispatchesMap = new Map<string, typeof allDispatches[0]>();

    qualityFilteredDispatches.forEach((dispatch) => {
      // Create a unique key from date, billNo, transportNo, lrNo
      const dispatchDateStr = dispatch.dispatchDate ? formatDate(dispatch.dispatchDate) : '';
      const billNo = (dispatch.billNo || '').trim();
      const transportNo = (dispatch.transportNo || '').trim();
      const lrNo = (dispatch.lrNo || '').trim();
      const uniqueKey = `${dispatchDateStr}|${billNo}|${transportNo}|${lrNo}`;

      // Only keep the first dispatch with this unique combination
      // This means if m1, m2, m3 have the same date/bill/transport/LR, only one row will show
      if (!uniqueDispatchesMap.has(uniqueKey)) {
        uniqueDispatchesMap.set(uniqueKey, dispatch);
      }
    });

    // Convert map values to array - these are the unique dispatch rows to show (quality-filtered and grouped)
    const bottomFilteredDispatches = Array.from(uniqueDispatchesMap.values());

    console.log('PDF Generator - Bottom Table Unique Dispatches (Quality-filtered and Grouped by date/bill/transport/LR):', {
      totalDispatches: allDispatches.length,
      qualityFiltered: qualityFilteredDispatches.length,
      uniqueDispatches: bottomFilteredDispatches.length,
      qualityId: qualityId,
      groupedDispatches: bottomFilteredDispatches.map((d, idx) => ({
        index: idx + 1,
        date: d.dispatchDate,
        billNo: d.billNo,
        transport: d.transportNo,
        lrNo: d.lrNo
      }))
    });

    const minDispatchRows = 1; // Minimum 1 data row
    // Each unique dispatch item shows as ONE row (m1, m2, m3 with same date/bill/transport/LR = 1 row)
    const totalDispatchRows = Math.max(minDispatchRows, bottomFilteredDispatches.length);

    // Don't pre-check - let row-by-row check handle pagination
    // This allows maximum use of first page space
    const bottomTableWidth = pageWidth - 10; // Full width table
    const bottomRowHeight = 8; // Height for each row
    const bottomHeaderHeight = 8; // Height for header row
    const orderIdSectionHeight = 8; // Height for ORDER ID section

    // Only check if header fits, then let rows handle their own pagination
    if (bottomSectionStartY + bottomHeaderHeight > pageHeight - 5) {
      doc.addPage();
      bottomSectionStartY = 8; // Reset to top of new page
    }

    // Calculate column widths (4 columns)
    const col1Width = bottomTableWidth * 0.25; // Dispatch Date - 25%
    const col2Width = bottomTableWidth * 0.25; // Bill Number - 25%
    const col3Width = bottomTableWidth * 0.25; // Transport - 25%
    const col4Width = bottomTableWidth * 0.25; // LR No - 25%

    // Draw header row with proper borders
    const headerY = bottomSectionStartY;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);

    // Draw header border (top and sides)
    doc.rect(5, headerY, bottomTableWidth, bottomHeaderHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    // Header text
    doc.text('DISPATCH DATE', 5 + col1Width / 2, headerY + 5, { align: 'center' });
    doc.text('BILL NUMBER', 5 + col1Width + col2Width / 2, headerY + 5, { align: 'center' });
    doc.text('TRANSPORT', 5 + col1Width + col2Width + col3Width / 2, headerY + 5, { align: 'center' });
    doc.text('LR NO', 5 + col1Width + col2Width + col3Width + col4Width / 2, headerY + 5, { align: 'center' });

    // Draw vertical lines for header
    doc.line(5 + col1Width, headerY, 5 + col1Width, headerY + bottomHeaderHeight);
    doc.line(5 + col1Width + col2Width, headerY, 5 + col1Width + col2Width, headerY + bottomHeaderHeight);
    doc.line(5 + col1Width + col2Width + col3Width, headerY, 5 + col1Width + col2Width + col3Width, headerY + bottomHeaderHeight);

    // Draw horizontal line after header
    doc.line(5, headerY + bottomHeaderHeight, 5 + bottomTableWidth, headerY + bottomHeaderHeight);

    // Draw data rows with proper borders
    let currentBottomRowY = headerY + bottomHeaderHeight;
    let tableStartY = headerY; // Track where the table started for border drawing

    // Draw initial left and right borders starting from header
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(5, headerY, 5, currentBottomRowY); // Left border start
    doc.line(5 + bottomTableWidth, headerY, 5 + bottomTableWidth, currentBottomRowY); // Right border start

    for (let i = 0; i < totalDispatchRows; i++) {
      // Check if we need a new page for this row
      // Use minimal margin (5mm) - only break if row would actually overflow
      if (currentBottomRowY + bottomRowHeight > pageHeight - 5) {
        // Draw closing borders for current page before adding new page
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        // Draw left and right borders down to current position
        doc.line(5, tableStartY, 5, currentBottomRowY);
        doc.line(5 + bottomTableWidth, tableStartY, 5 + bottomTableWidth, currentBottomRowY);

        doc.addPage();
        currentBottomRowY = 8; // Reset to top of new page
        tableStartY = currentBottomRowY; // New table start on new page

        // Redraw header on new page with proper borders
        const newHeaderY = currentBottomRowY;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(5, newHeaderY, bottomTableWidth, bottomHeaderHeight);

        // Header text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text('DISPATCH DATE', 5 + col1Width / 2, newHeaderY + 5, { align: 'center' });
        doc.text('BILL NUMBER', 5 + col1Width + col2Width / 2, newHeaderY + 5, { align: 'center' });
        doc.text('TRANSPORT', 5 + col1Width + col2Width + col3Width / 2, newHeaderY + 5, { align: 'center' });
        doc.text('LR NO', 5 + col1Width + col2Width + col3Width + col4Width / 2, newHeaderY + 5, { align: 'center' });

        // Draw vertical lines for header
        doc.line(5 + col1Width, newHeaderY, 5 + col1Width, newHeaderY + bottomHeaderHeight);
        doc.line(5 + col1Width + col2Width, newHeaderY, 5 + col1Width + col2Width, newHeaderY + bottomHeaderHeight);
        doc.line(5 + col1Width + col2Width + col3Width, newHeaderY, 5 + col1Width + col2Width + col3Width, newHeaderY + bottomHeaderHeight);

        // Draw horizontal line after header
        doc.line(5, newHeaderY + bottomHeaderHeight, 5 + bottomTableWidth, newHeaderY + bottomHeaderHeight);

        currentBottomRowY = newHeaderY + bottomHeaderHeight;
      }

      // Draw row border before adding data
      const rowStartY = currentBottomRowY;
      currentBottomRowY += bottomRowHeight;

      // Draw horizontal line for this row (bottom border of row)
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(5, currentBottomRowY, 5 + bottomTableWidth, currentBottomRowY);

      // Draw vertical lines for columns (extend through the row)
      doc.line(5 + col1Width, rowStartY, 5 + col1Width, currentBottomRowY);
      doc.line(5 + col1Width + col2Width, rowStartY, 5 + col1Width + col2Width, currentBottomRowY);
      doc.line(5 + col1Width + col2Width + col3Width, rowStartY, 5 + col1Width + col2Width + col3Width, currentBottomRowY);

      // Add data to each row
      // Each unique dispatch item shows as ONE row
      // If Dispatch Item 1 has m1, m2, m3 finish meters with same date/bill/transport/LR, it shows as 1 row
      // Only when you add a NEW dispatch item (different date/bill/transport/LR) will it show as a new row
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 43, 89); // Blue color (#002b59) for data

      if (i < bottomFilteredDispatches.length) {
        const dispatch = bottomFilteredDispatches[i];

        // Each unique dispatch item is rendered as ONE row (m1, m2, m3 grouped together)
        // Dispatch Date
        const dispatchDateText = formatDate(dispatch.dispatchDate).toUpperCase();
        doc.text(dispatchDateText, 5 + col1Width / 2, currentBottomRowY - 3, { align: 'center' });

        // Bill Number
        doc.text((dispatch.billNo || '').toUpperCase(), 5 + col1Width + col2Width / 2, currentBottomRowY - 3, { align: 'center' });

        // Transport
        doc.text((dispatch.transportNo || '').toUpperCase(), 5 + col1Width + col2Width + col3Width / 2, currentBottomRowY - 3, { align: 'center' });

        // LR No
        doc.text((dispatch.lrNo || '').toUpperCase(), 5 + col1Width + col2Width + col3Width + col4Width / 2, currentBottomRowY - 3, { align: 'center' });
      } else {
        // Empty row (if beyond available data but within minimum 1 row)
        doc.text('', 5 + col1Width / 2, currentBottomRowY - 3, { align: 'center' }); // Dispatch Date
        doc.text('', 5 + col1Width + col2Width / 2, currentBottomRowY - 3, { align: 'center' }); // Bill Number
        doc.text('', 5 + col1Width + col2Width + col3Width / 2, currentBottomRowY - 3, { align: 'center' }); // Transport
        doc.text('', 5 + col1Width + col2Width + col3Width + col4Width / 2, currentBottomRowY - 3, { align: 'center' }); // LR No
      }

      doc.setTextColor(0, 0, 0); // Reset to black
    }

    // Draw closing borders for the table (left and right sides)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(5, tableStartY, 5, currentBottomRowY); // Left border
    doc.line(5 + bottomTableWidth, tableStartY, 5 + bottomTableWidth, currentBottomRowY); // Right border

    // ORDER ID section below the table
    let orderIdSectionY = currentBottomRowY + 5;

    // Check if we need a new page for ORDER ID section
    // Use minimal margin (5mm) - only break if section would actually overflow
    // Note: orderIdSectionHeight is already declared earlier (line 1329)
    if (orderIdSectionY + orderIdSectionHeight > pageHeight - 5) {
      doc.addPage();
      orderIdSectionY = 8; // Reset to top of new page
    }

    // Draw border around ORDER ID section
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(5, orderIdSectionY, bottomTableWidth, orderIdSectionHeight);

    // ORDER ID label and value - label on left, value on right
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('ORDER ID:', 8, orderIdSectionY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 43, 89); // Blue color (#002b59) for data
    // Show only the sequence part (e.g. 001, 002) as requested
    const sequencePart = (order.orderId || '').split('-').pop() || (order.orderId || '');

    const orderIdText = sequencePart.toUpperCase();
    const orderIdTextWidth = doc.getTextWidth(orderIdText);
    doc.text(orderIdText, 5 + bottomTableWidth - orderIdTextWidth - 8, orderIdSectionY + 5);
    doc.setTextColor(0, 0, 0); // Reset to black

    // Download the PDF
    const fileName = `FABRIC_PURCHASE_ORDER_SHEET_${(order.orderId || '').toUpperCase()}_${formatDate(new Date()).replace(/\//g, '-')}.pdf`;
    if (typeof window !== 'undefined') {
      doc.save(fileName);
    }

    console.log('PDF Generator - PDF generated successfully:', fileName);
    return doc;

  } catch (error) {
    console.error('PDF Generator - Error generating PDF:', error);
    if (typeof window !== 'undefined') {
      alert('Failed to generate PDF. Please check the console for details.');
    }
    throw error;
  }
};

// Interface for fabric sticker data
interface FabricStickerData {
  qualityCode: string;
  qualityName: string;
  width?: number; // Width in inches
  gsm?: number;
  content?: string;
  remarks?: string;
  count?: string; // e.g., "80 x 80"
  rxP?: string; // e.g., "112/80"
  moq?: string; // e.g., "3000 mtr"
  weaver?: string;
  weaverQualityName?: string;
}

// Generate fabric sticker PDF (50mm height x 100mm width - landscape)
export const generateFabricStickerPDF = (fabric: FabricStickerData): string => {
  try {
    // Create PDF with custom size: 50mm height x 100mm width (landscape)
    const widthMM = 100;  // Width
    const heightMM = 50;  // Height

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [widthMM, heightMM]
    });

    // Set background color (white)
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, widthMM, heightMM, 'F');

    // Draw rounded border around entire page - increased margin
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    const borderRadius = 2; // 2mm radius for rounded corners
    const margin = 1.5; // Increased margin from edge

    // Draw rounded page border using rounded line joins
    doc.setLineJoin('round');
    doc.setLineCap('round');

    // Draw the border as a rectangle with rounded corners
    doc.rect(margin, margin, widthMM - (margin * 2), heightMM - (margin * 2), 'S');

    // Top margin
    let yPos = margin + 4.0;

    // Brand name: VIRAL FABRICS
    const brandText = 'VIRAL FABRICS';
    const availableBrandWidth = widthMM - (margin * 2) - 1;
    let brandFontSize = 10.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(brandFontSize);
    let brandWidth = doc.getTextWidth(brandText);
    while (brandWidth > availableBrandWidth * 0.85 && brandFontSize > 6) {
      brandFontSize -= 0.5;
      doc.setFontSize(brandFontSize);
      brandWidth = doc.getTextWidth(brandText);
    }
    doc.setTextColor(0, 0, 0);
    const brandX = (widthMM - brandWidth) / 2;
    doc.text(brandText, brandX, yPos);

    // Add slogan text
    yPos += 2.0;
    const sloganText = 'MPO & SUPPLIER OF: ALL TYPE OF EXPORT';
    let sloganFontSize = 4.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(sloganFontSize);
    let sloganWidth = doc.getTextWidth(sloganText);
    const availableSloganWidth = widthMM - (margin * 2) - 1;
    while (sloganWidth > availableSloganWidth * 0.95 && sloganFontSize > 3) {
      sloganFontSize -= 0.2;
      doc.setFontSize(sloganFontSize);
      sloganWidth = doc.getTextWidth(sloganText);
    }
    const sloganX = (widthMM - sloganWidth) / 2;
    doc.text(sloganText, sloganX, yPos);

    yPos += 2.0;

    // Table section - systematic calculated layout
    const tableX = margin + 0.5;
    const tableWidth = widthMM - (margin * 2) - 1;
    let currentY = yPos;
    // Calculate row height to use all available space (6 rows total) with proper bottom margin
    const availableHeight = heightMM - currentY - margin - 1.5;
    const rowHeight = availableHeight / 6; // 6 rows: Quality Code, Quality Name, Width/Count, GSM/R*P, Content/MOQ, Remarks

    // Systematic column width calculation
    const totalWidth = tableWidth;
    const leftLabelWidth = 28; // Left label column width
    const leftValueWidth = 32; // Left value column width
    const rightLabelWidth = 16; // Right label column width (for Count, R x P, MOQ)
    const rightValueWidth = 18; // Right value column width
    const dividerX = tableX + leftLabelWidth; // First divider (after left label)
    const rightDividerX = tableX + tableWidth / 2; // Divider in middle of sticker (between left and right sections)
    const rightValueDividerX = rightDividerX + rightLabelWidth + 1; // Divider between right label and value

    // Helper function to add table row with divider - systematic layout
    const addTableRow = (label: string, value: string) => {
      // Draw horizontal line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(tableX, currentY, tableX + tableWidth, currentY);

      // Calculate font size to fit in available space
      const labelFontSize = 7.5;
      const valueFontSize = 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.setTextColor(0, 0, 0);
      const textY = currentY + rowHeight / 2 + 1.5; // Calculated vertical centering

      // Label (left side) - with calculated positioning
      doc.text(label, tableX + 0.8, textY);

      // Divider line (vertical)
      doc.setLineWidth(0.5);
      doc.line(dividerX, currentY, dividerX, currentY + rowHeight);

      // Value (right side of divider) - with calculated positioning
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(value, dividerX + 0.8, textY);

      currentY += rowHeight;
    };

    // Helper function to add table row with right side data - systematic layout
    const addTableRowWithRight = (label: string, value: string, rightLabel: string, rightValue: string) => {
      // Draw horizontal line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(tableX, currentY, tableX + tableWidth, currentY);

      // Calculate font size to fit in available space
      const labelFontSize = 7.5;
      const valueFontSize = 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.setTextColor(0, 0, 0);
      const textY = currentY + rowHeight / 2 + 1.5; // Calculated vertical centering

      // Left label - with calculated positioning
      doc.text(label, tableX + 0.8, textY);

      // First divider line (vertical) - after left label
      doc.setLineWidth(0.5);
      doc.line(dividerX, currentY, dividerX, currentY + rowHeight);

      // Left value - with calculated positioning
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(value, dividerX + 0.8, textY);

      // Right side divider (vertical line separating left and right sections)
      doc.setLineWidth(0.5);
      doc.line(rightDividerX, currentY, rightDividerX, currentY + rowHeight);

      // Right side label (Count, R x P, MOQ) - with calculated positioning
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.text(rightLabel, rightDividerX + 0.8, textY);

      // Divider line between right label and right value
      doc.setLineWidth(0.5);
      doc.line(rightValueDividerX, currentY, rightValueDividerX, currentY + rowHeight);

      // Right side value - with calculated positioning and proper space
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(rightValue, rightValueDividerX + 0.8, textY);

      currentY += rowHeight;
    };

    // Quality Code
    addTableRow('Quality Code', fabric.qualityCode || '-');

    // Quality Name
    addTableRow('Quality Name', fabric.qualityName || '-');

    // Width (Inch) with Count on right
    const widthValue = fabric.width ? `${fabric.width}"` : '-';
    const countValue = fabric.count || ''; // Use danier, empty if not available
    addTableRowWithRight('Width (Inch)', widthValue, 'Count', countValue);

    // GSM with R x P on right
    const gsmValue = fabric.gsm ? fabric.gsm.toString() : '-';
    const rxPValue = fabric.rxP || '-'; // Format: reed/pick
    addTableRowWithRight('GSM', gsmValue, 'R x P', rxPValue);

    // Content with MOQ on right
    const contentValue = fabric.content || '-';
    const moqValue = fabric.moq || ''; // Empty/blank for MOQ
    addTableRowWithRight('Content', contentValue, 'MOQ', moqValue);

    // Remarks (just line, no right side) - empty/blank
    addTableRow('Remarks', fabric.remarks || '');

    // Return PDF as data URL for preview
    return doc.output('dataurlstring');

  } catch (error) {
    console.error('PDF Generator - Error generating fabric sticker PDF:', error);
    throw error;
  }
};

// Generate and download fabric sticker PDF (50mm height x 100mm width - landscape)
export const downloadFabricStickerPDF = (fabric: FabricStickerData): void => {
  try {
    // Create PDF with custom size: 50mm height x 100mm width (landscape)
    const widthMM = 100;  // Width
    const heightMM = 50;  // Height

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [widthMM, heightMM]
    });

    // Set background color (white)
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, widthMM, heightMM, 'F');

    // Draw rounded border around entire page - increased margin
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    const borderRadius = 2; // 2mm radius for rounded corners
    const margin = 1.5; // Increased margin from edge

    // Draw rounded page border using rounded line joins
    doc.setLineJoin('round');
    doc.setLineCap('round');

    // Draw the border as a rectangle with rounded corners
    doc.rect(margin, margin, widthMM - (margin * 2), heightMM - (margin * 2), 'S');

    // Top margin - proper space for first line
    let yPos = margin + 3.0;

    // Brand name: VIRAL FABRICS - properly fixed in box on first line
    const brandText = 'VIRAL FABRICS';
    const availableBrandWidth = widthMM - (margin * 2) - 1;
    let brandFontSize = 10.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(brandFontSize);
    let brandWidth = doc.getTextWidth(brandText);
    // Reduce font size if it doesn't fit
    while (brandWidth > availableBrandWidth * 0.85 && brandFontSize > 6) {
      brandFontSize -= 0.5;
      doc.setFontSize(brandFontSize);
      brandWidth = doc.getTextWidth(brandText);
    }
    doc.setTextColor(0, 0, 0);
    // Center the text properly in the first line
    const brandX = (widthMM - brandWidth) / 2;
    doc.text(brandText, brandX, yPos);

    // Add slogan text under VIRAL FABRICS - small capital letters
    yPos += 2.0; // Proper space after brand name
    const sloganText = 'MPO & SUPPLIER OF: ALL TYPE OF EXPORT';
    let sloganFontSize = 4.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(sloganFontSize);
    let sloganWidth = doc.getTextWidth(sloganText);
    const availableSloganWidth = widthMM - (margin * 2) - 1;
    // Reduce font size if it doesn't fit
    while (sloganWidth > availableSloganWidth * 0.95 && sloganFontSize > 3) {
      sloganFontSize -= 0.2;
      doc.setFontSize(sloganFontSize);
      sloganWidth = doc.getTextWidth(sloganText);
    }
    const sloganX = (widthMM - sloganWidth) / 2;
    doc.text(sloganText, sloganX, yPos);

    yPos += 2.0; // Proper space after slogan - no divider line here, first table row will draw it

    // Table section - systematic calculated layout
    const tableX = margin + 0.5;
    const tableWidth = widthMM - (margin * 2) - 1;
    let currentY = yPos;
    // Calculate row height to use all available space (6 rows total) with proper bottom margin
    const availableHeight = heightMM - currentY - margin - 1.5;
    const rowHeight = availableHeight / 6; // 6 rows: Quality Code, Quality Name, Width/Count, GSM/R*P, Content/MOQ, Remarks

    // Systematic column width calculation
    const totalWidth = tableWidth;
    const leftLabelWidth = 28; // Left label column width
    const leftValueWidth = 32; // Left value column width
    const rightLabelWidth = 16; // Right label column width (for Count, R x P, MOQ)
    const rightValueWidth = 18; // Right value column width
    const dividerX = tableX + leftLabelWidth; // First divider (after left label)
    const rightDividerX = tableX + tableWidth / 2; // Divider in middle of sticker (between left and right sections)
    const rightValueDividerX = rightDividerX + rightLabelWidth + 1; // Divider between right label and value

    // Helper function to add table row with divider - systematic layout
    const addTableRow = (label: string, value: string) => {
      // Draw horizontal line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(tableX, currentY, tableX + tableWidth, currentY);

      // Calculate font size to fit in available space
      const labelFontSize = 7.5;
      const valueFontSize = 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.setTextColor(0, 0, 0);
      const textY = currentY + rowHeight / 2 + 1.5; // Calculated vertical centering

      // Label (left side) - with calculated positioning
      doc.text(label, tableX + 0.8, textY);

      // Divider line (vertical)
      doc.setLineWidth(0.5);
      doc.line(dividerX, currentY, dividerX, currentY + rowHeight);

      // Value (right side of divider) - with calculated positioning
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(value, dividerX + 0.8, textY);

      currentY += rowHeight;
    };

    // Helper function to add table row with right side data - systematic layout
    const addTableRowWithRight = (label: string, value: string, rightLabel: string, rightValue: string) => {
      // Draw horizontal line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(tableX, currentY, tableX + tableWidth, currentY);

      // Calculate font size to fit in available space
      const labelFontSize = 7.5;
      const valueFontSize = 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.setTextColor(0, 0, 0);
      const textY = currentY + rowHeight / 2 + 1.5; // Calculated vertical centering

      // Left label - with calculated positioning
      doc.text(label, tableX + 0.8, textY);

      // First divider line (vertical) - after left label
      doc.setLineWidth(0.5);
      doc.line(dividerX, currentY, dividerX, currentY + rowHeight);

      // Left value - with calculated positioning
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(value, dividerX + 0.8, textY);

      // Right side divider (vertical line separating left and right sections)
      doc.setLineWidth(0.5);
      doc.line(rightDividerX, currentY, rightDividerX, currentY + rowHeight);

      // Right side label (Count, R x P, MOQ) - with calculated positioning
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.text(rightLabel, rightDividerX + 0.8, textY);

      // Divider line between right label and right value
      doc.setLineWidth(0.5);
      doc.line(rightValueDividerX, currentY, rightValueDividerX, currentY + rowHeight);

      // Right side value - with calculated positioning and proper space
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(rightValue, rightValueDividerX + 0.8, textY);

      currentY += rowHeight;
    };

    // Quality Code
    addTableRow('Quality Code', fabric.qualityCode || '-');

    // Quality Name
    addTableRow('Quality Name', fabric.qualityName || '-');

    // Width (Inch) with Count on right
    const widthValue = fabric.width ? `${fabric.width}"` : '-';
    const countValue = fabric.count || ''; // Use danier, empty if not available
    addTableRowWithRight('Width (Inch)', widthValue, 'Count', countValue);

    // GSM with R x P on right
    const gsmValue = fabric.gsm ? fabric.gsm.toString() : '-';
    const rxPValue = fabric.rxP || '-'; // Format: reed/pick
    addTableRowWithRight('GSM', gsmValue, 'R x P', rxPValue);

    // Content with MOQ on right
    const contentValue = fabric.content || '-';
    const moqValue = fabric.moq || ''; // Empty/blank for MOQ
    addTableRowWithRight('Content', contentValue, 'MOQ', moqValue);

    // Remarks (just line, no right side) - empty/blank
    addTableRow('Remarks', fabric.remarks || '');

    // Download the PDF using blob method (works on all devices including mobile)
    const fileName = `FABRIC_STICKER_${fabric.qualityCode || 'STICKER'}_${new Date().toISOString().split('T')[0]}.pdf`;

    // Get PDF as blob
    const pdfBlob = doc.output('blob');

    // Create download link
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';

    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up blob URL after a delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);

    if (process.env.NODE_ENV === 'development') {
      console.log('PDF Generator - Fabric sticker PDF generated successfully:', fileName);
    }

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('PDF Generator - Error generating fabric sticker PDF:', error);
    }
    // Use alert as fallback for critical errors
    if (typeof window !== 'undefined') {
      alert('Failed to generate sticker PDF. Please try again.');
    }
    throw error;
  }
};

// Direct download method (works on all devices including mobile)
export const downloadFabricStickerPDFDirect = (fabric: FabricStickerData): void => {
  try {
    // Create PDF with custom size: 50mm height x 100mm width (landscape)
    const widthMM = 100;  // Width
    const heightMM = 50;  // Height

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [widthMM, heightMM]
    });

    // Set background color (white)
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, widthMM, heightMM, 'F');

    // Draw rounded border around entire page - increased margin
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    const borderRadius = 2; // 2mm radius for rounded corners
    const margin = 1.5; // Increased margin from edge

    // Draw rounded page border using rounded line joins
    doc.setLineJoin('round');
    doc.setLineCap('round');

    // Draw the border as a rectangle with rounded corners
    doc.rect(margin, margin, widthMM - (margin * 2), heightMM - (margin * 2), 'S');

    // Top margin
    let yPos = margin + 4.0;

    // Brand name: VIRAL FABRICS
    const brandText = 'VIRAL FABRICS';
    const availableBrandWidth = widthMM - (margin * 2) - 1;
    let brandFontSize = 10.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(brandFontSize);
    let brandWidth = doc.getTextWidth(brandText);
    while (brandWidth > availableBrandWidth * 0.85 && brandFontSize > 6) {
      brandFontSize -= 0.5;
      doc.setFontSize(brandFontSize);
      brandWidth = doc.getTextWidth(brandText);
    }
    doc.setTextColor(0, 0, 0);
    const brandX = (widthMM - brandWidth) / 2;
    doc.text(brandText, brandX, yPos);

    // Add slogan text
    yPos += 2.0;
    const sloganText = 'MFG & SUPPLIER OF ALL TYPES OF EXPORT FABRICS';
    let sloganFontSize = 4.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(sloganFontSize);
    let sloganWidth = doc.getTextWidth(sloganText);
    const availableSloganWidth = widthMM - (margin * 2) - 1;
    while (sloganWidth > availableSloganWidth * 0.95 && sloganFontSize > 3) {
      sloganFontSize -= 0.2;
      doc.setFontSize(sloganFontSize);
      sloganWidth = doc.getTextWidth(sloganText);
    }
    const sloganX = (widthMM - sloganWidth) / 2;
    doc.text(sloganText, sloganX, yPos);

    yPos += 2.0;

    // Table section - systematic calculated layout
    const tableX = margin + 0.5;
    const tableWidth = widthMM - (margin * 2) - 1;
    let currentY = yPos;
    // Calculate row height to use all available space (6 rows total) with proper bottom margin
    const availableHeight = heightMM - currentY - margin - 1.5;
    const rowHeight = availableHeight / 6; // 6 rows: Quality Code, Quality Name, Width/Count, GSM/R*P, Content/MOQ, Remarks

    // Systematic column width calculation
    const totalWidth = tableWidth;
    const leftLabelWidth = 28; // Left label column width
    const leftValueWidth = 32; // Left value column width
    const rightLabelWidth = 16; // Right label column width (for Count, R x P, MOQ)
    const rightValueWidth = 18; // Right value column width
    const dividerX = tableX + leftLabelWidth; // First divider (after left label)
    const rightDividerX = tableX + tableWidth / 2; // Divider in middle of sticker (between left and right sections)
    const rightValueDividerX = rightDividerX + rightLabelWidth + 1; // Divider between right label and value

    // Helper function to add table row with divider - systematic layout
    const addTableRow = (label: string, value: string) => {
      // Draw horizontal line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(tableX, currentY, tableX + tableWidth, currentY);

      // Calculate font size to fit in available space
      const labelFontSize = 7.5;
      const valueFontSize = 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.setTextColor(0, 0, 0);
      const textY = currentY + rowHeight / 2 + 1.5; // Calculated vertical centering

      // Label (left side) - with calculated positioning
      doc.text(label, tableX + 0.8, textY);

      // Divider line (vertical)
      doc.setLineWidth(0.5);
      doc.line(dividerX, currentY, dividerX, currentY + rowHeight);

      // Value (right side of divider) - with calculated positioning
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(value, dividerX + 0.8, textY);

      currentY += rowHeight;
    };

    // Helper function to add table row with right side data - systematic layout
    const addTableRowWithRight = (label: string, value: string, rightLabel: string, rightValue: string) => {
      // Draw horizontal line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(tableX, currentY, tableX + tableWidth, currentY);

      // Calculate font size to fit in available space
      const labelFontSize = 7.5;
      const valueFontSize = 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.setTextColor(0, 0, 0);
      const textY = currentY + rowHeight / 2 + 1.5; // Calculated vertical centering

      // Left label - with calculated positioning
      doc.text(label, tableX + 0.8, textY);

      // First divider line (vertical) - after left label
      doc.setLineWidth(0.5);
      doc.line(dividerX, currentY, dividerX, currentY + rowHeight);

      // Left value - with calculated positioning
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(value, dividerX + 0.8, textY);

      // Right side divider (vertical line separating left and right sections)
      doc.setLineWidth(0.5);
      doc.line(rightDividerX, currentY, rightDividerX, currentY + rowHeight);

      // Right side label (Count, R x P, MOQ) - with calculated positioning
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.text(rightLabel, rightDividerX + 0.8, textY);

      // Divider line between right label and right value
      doc.setLineWidth(0.5);
      doc.line(rightValueDividerX, currentY, rightValueDividerX, currentY + rowHeight);

      // Right side value - with calculated positioning and proper space
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(rightValue, rightValueDividerX + 0.8, textY);

      currentY += rowHeight;
    };

    // Quality Code
    addTableRow('Quality Code', fabric.qualityCode || '-');

    // Quality Name
    addTableRow('Quality Name', fabric.qualityName || '-');

    // Width (Inch) with Count on right
    const widthValue = fabric.width ? `${fabric.width}"` : '-';
    const countValue = fabric.count || ''; // Use danier, empty if not available
    addTableRowWithRight('Width (Inch)', widthValue, 'Count', countValue);

    // GSM with R x P on right
    const gsmValue = fabric.gsm ? fabric.gsm.toString() : '-';
    const rxPValue = fabric.rxP || '-'; // Format: reed/pick
    addTableRowWithRight('GSM', gsmValue, 'R x P', rxPValue);

    // Content with MOQ on right
    const contentValue = fabric.content || '-';
    const moqValue = fabric.moq || ''; // Empty/blank for MOQ
    addTableRowWithRight('Content', contentValue, 'MOQ', moqValue);

    // Remarks (just line, no right side) - empty/blank
    addTableRow('Remarks', fabric.remarks || '');

    // Download the PDF using blob method (works on all devices including mobile)
    const fileName = `FABRIC_STICKER_${fabric.qualityCode || 'STICKER'}_${new Date().toISOString().split('T')[0]}.pdf`;

    // Get PDF as blob
    const pdfBlob = doc.output('blob');

    // Create download link
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';

    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up blob URL after a delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);

    if (process.env.NODE_ENV === 'development') {
      console.log('PDF Generator - Fabric sticker PDF downloaded directly:', fileName);
    }

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('PDF Generator - Error downloading fabric sticker PDF:', error);
    }
    // Use alert as fallback for critical errors
    if (typeof window !== 'undefined') {
      alert('Failed to generate sticker PDF. Please try again.');
    }
    throw error;
  }
};

// Sample Sticker Data Interface
interface SampleStickerData {
  qualityName: string;
  weaverName?: string;
  width?: number; // Finish width in inches
  gsm?: number;
  content?: string;
  count?: number;
  rxP?: string; // e.g., "112/80"
  danier?: string;
  moq?: number;
  rack?: string;
}

// Generate sample sticker PDF (50mm height x 100mm width - landscape)
export const generateSampleStickerPDF = (sample: SampleStickerData): string => {
  try {
    // Create PDF with custom size: 50mm height x 100mm width (landscape)
    const widthMM = 100;  // Width
    const heightMM = 50;  // Height

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [widthMM, heightMM]
    });

    // Set background color (white)
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, widthMM, heightMM, 'F');

    // Draw rounded border around entire page
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    const margin = 1.5;

    doc.setLineJoin('round');
    doc.setLineCap('round');
    doc.rect(margin, margin, widthMM - (margin * 2), heightMM - (margin * 2), 'S');

    // Top margin
    let yPos = margin + 4.0;

    // Brand name: VIRAL FABRICS
    const brandText = 'VIRAL FABRICS';
    const availableBrandWidth = widthMM - (margin * 2) - 1;
    let brandFontSize = 10.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(brandFontSize);
    let brandWidth = doc.getTextWidth(brandText);
    while (brandWidth > availableBrandWidth * 0.85 && brandFontSize > 6) {
      brandFontSize -= 0.5;
      doc.setFontSize(brandFontSize);
      brandWidth = doc.getTextWidth(brandText);
    }
    doc.setTextColor(0, 0, 0);
    const brandX = (widthMM - brandWidth) / 2;
    doc.text(brandText, brandX, yPos);

    // Add slogan text
    yPos += 2.0;
    const sloganText = 'MFG & SUPPLIER OF ALL TYPES OF EXPORT FABRICS';
    let sloganFontSize = 4.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(sloganFontSize);
    let sloganWidth = doc.getTextWidth(sloganText);
    const availableSloganWidth = widthMM - (margin * 2) - 1;
    while (sloganWidth > availableSloganWidth * 0.95 && sloganFontSize > 3) {
      sloganFontSize -= 0.2;
      doc.setFontSize(sloganFontSize);
      sloganWidth = doc.getTextWidth(sloganText);
    }
    const sloganX = (widthMM - sloganWidth) / 2;
    doc.text(sloganText, sloganX, yPos);

    yPos += 2.0;

    // Table section
    const tableX = margin + 0.5;
    const tableWidth = widthMM - (margin * 2) - 1;
    let currentY = yPos;
    const availableHeight = heightMM - currentY - margin - 1.5;
    // Always use 6 rows (Remarks always shown, empty like MOQ)
    const rowCount = 6;
    const rowHeight = availableHeight / rowCount;

    // Column widths
    const leftLabelWidth = 28;
    const leftValueWidth = 32;
    const rightLabelWidth = 16;
    const rightValueWidth = 18;
    const dividerX = tableX + leftLabelWidth;
    const rightDividerX = tableX + tableWidth / 2;
    const rightValueDividerX = rightDividerX + rightLabelWidth + 1;

    // Helper function to add table row
    const addTableRow = (label: string, value: string) => {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(tableX, currentY, tableX + tableWidth, currentY);

      const labelFontSize = 7.5;
      const valueFontSize = 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.setTextColor(0, 0, 0);
      const textY = currentY + rowHeight / 2 + 1.5;

      doc.text(label, tableX + 0.8, textY);

      doc.setLineWidth(0.5);
      doc.line(dividerX, currentY, dividerX, currentY + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(value, dividerX + 0.8, textY);

      currentY += rowHeight;
    };

    // Helper function to add table row with right side data
    const addTableRowWithRight = (label: string, value: string, rightLabel: string, rightValue: string) => {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(tableX, currentY, tableX + tableWidth, currentY);

      const labelFontSize = 7.5;
      const valueFontSize = 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.setTextColor(0, 0, 0);
      const textY = currentY + rowHeight / 2 + 1.5;

      doc.text(label, tableX + 0.8, textY);

      doc.setLineWidth(0.5);
      doc.line(dividerX, currentY, dividerX, currentY + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(value, dividerX + 0.8, textY);

      doc.setLineWidth(0.5);
      doc.line(rightDividerX, currentY, rightDividerX, currentY + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.text(rightLabel, rightDividerX + 0.8, textY);

      doc.setLineWidth(0.5);
      doc.line(rightValueDividerX, currentY, rightValueDividerX, currentY + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(rightValue, rightValueDividerX + 0.8, textY);

      currentY += rowHeight;
    };

    // Quality Name
    addTableRow('Quality Name', sample.qualityName || '-');

    // Weaver Name (if available)
    if (sample.weaverName) {
      addTableRow('Weaver', sample.weaverName);
    }

    // Width (Inch) with Count on right
    const widthValue = sample.width ? `${sample.width}"` : '-';
    const countValue = sample.count ? sample.count.toString() : (sample.danier || '');
    addTableRowWithRight('Width (Inch)', widthValue, 'Count', countValue);

    // GSM with R x P on right
    const gsmValue = sample.gsm ? sample.gsm.toString() : '-';
    const rxPValue = sample.rxP || '-';
    addTableRowWithRight('GSM', gsmValue, 'R x P', rxPValue);

    // Content with MOQ on right (if available)
    const contentValue = sample.content || '-';
    const moqValue = sample.moq ? sample.moq.toString() : ''; // Empty string for client requirement
    addTableRowWithRight('Content', contentValue, 'MOQ', moqValue);

    // Remarks - always show empty like MOQ
    addTableRow('Remarks', '');

    // Return PDF as data URL for preview
    return doc.output('dataurlstring');

  } catch (error) {
    console.error('PDF Generator - Error generating sample sticker PDF:', error);
    throw error;
  }
};

// Direct download method for sample sticker (works on all devices including mobile)
export const downloadSampleStickerPDFDirect = (sample: SampleStickerData): void => {
  try {
    // Create PDF with custom size: 50mm height x 100mm width (landscape)
    const widthMM = 100;
    const heightMM = 50;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [widthMM, heightMM]
    });

    // Set background color (white)
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, widthMM, heightMM, 'F');

    // Draw rounded border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    const margin = 1.5;

    doc.setLineJoin('round');
    doc.setLineCap('round');
    doc.rect(margin, margin, widthMM - (margin * 2), heightMM - (margin * 2), 'S');

    // Top margin
    let yPos = margin + 4.0;

    // Brand name: VIRAL FABRICS
    const brandText = 'VIRAL FABRICS';
    const availableBrandWidth = widthMM - (margin * 2) - 1;
    let brandFontSize = 10.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(brandFontSize);
    let brandWidth = doc.getTextWidth(brandText);
    while (brandWidth > availableBrandWidth * 0.85 && brandFontSize > 6) {
      brandFontSize -= 0.5;
      doc.setFontSize(brandFontSize);
      brandWidth = doc.getTextWidth(brandText);
    }
    doc.setTextColor(0, 0, 0);
    const brandX = (widthMM - brandWidth) / 2;
    doc.text(brandText, brandX, yPos);

    // Add slogan text
    yPos += 2.0;
    const sloganText = 'MFG & SUPPLIER OF ALL TYPES OF EXPORT FABRICS';
    let sloganFontSize = 4.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(sloganFontSize);
    let sloganWidth = doc.getTextWidth(sloganText);
    const availableSloganWidth = widthMM - (margin * 2) - 1;
    while (sloganWidth > availableSloganWidth * 0.95 && sloganFontSize > 3) {
      sloganFontSize -= 0.2;
      doc.setFontSize(sloganFontSize);
      sloganWidth = doc.getTextWidth(sloganText);
    }
    const sloganX = (widthMM - sloganWidth) / 2;
    doc.text(sloganText, sloganX, yPos);

    yPos += 2.0;

    // Table section
    const tableX = margin + 0.5;
    const tableWidth = widthMM - (margin * 2) - 1;
    let currentY = yPos;
    const availableHeight = heightMM - currentY - margin - 1.5;
    // Always use 6 rows (Remarks always shown, empty like MOQ)
    const rowCount = 6;
    const rowHeight = availableHeight / rowCount;

    // Column widths
    const leftLabelWidth = 28;
    const leftValueWidth = 32;
    const rightLabelWidth = 16;
    const rightValueWidth = 18;
    const dividerX = tableX + leftLabelWidth;
    const rightDividerX = tableX + tableWidth / 2;
    const rightValueDividerX = rightDividerX + rightLabelWidth + 1;

    // Helper function to add table row
    const addTableRow = (label: string, value: string) => {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(tableX, currentY, tableX + tableWidth, currentY);

      const labelFontSize = 7.5;
      const valueFontSize = 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.setTextColor(0, 0, 0);
      const textY = currentY + rowHeight / 2 + 1.5;

      doc.text(label, tableX + 0.8, textY);

      doc.setLineWidth(0.5);
      doc.line(dividerX, currentY, dividerX, currentY + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(value, dividerX + 0.8, textY);

      currentY += rowHeight;
    };

    // Helper function to add table row with right side data
    const addTableRowWithRight = (label: string, value: string, rightLabel: string, rightValue: string) => {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(tableX, currentY, tableX + tableWidth, currentY);

      const labelFontSize = 7.5;
      const valueFontSize = 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.setTextColor(0, 0, 0);
      const textY = currentY + rowHeight / 2 + 1.5;

      doc.text(label, tableX + 0.8, textY);

      doc.setLineWidth(0.5);
      doc.line(dividerX, currentY, dividerX, currentY + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(value, dividerX + 0.8, textY);

      doc.setLineWidth(0.5);
      doc.line(rightDividerX, currentY, rightDividerX, currentY + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(labelFontSize);
      doc.text(rightLabel, rightDividerX + 0.8, textY);

      doc.setLineWidth(0.5);
      doc.line(rightValueDividerX, currentY, rightValueDividerX, currentY + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.text(rightValue, rightValueDividerX + 0.8, textY);

      currentY += rowHeight;
    };

    // Quality Name
    addTableRow('Quality Name', sample.qualityName || '-');

    // Weaver Name (if available)
    if (sample.weaverName) {
      addTableRow('Weaver', sample.weaverName);
    }

    // Width (Inch) with Count on right
    const widthValue = sample.width ? `${sample.width}"` : '-';
    const countValue = sample.count ? sample.count.toString() : (sample.danier || '');
    addTableRowWithRight('Width (Inch)', widthValue, 'Count', countValue);

    // GSM with R x P on right
    const gsmValue = sample.gsm ? sample.gsm.toString() : '-';
    const rxPValue = sample.rxP || '-';
    addTableRowWithRight('GSM', gsmValue, 'R x P', rxPValue);

    // Content with MOQ on right (if available)
    const contentValue = sample.content || '-';
    const moqValue = sample.moq ? sample.moq.toString() : ''; // Empty string for client requirement
    addTableRowWithRight('Content', contentValue, 'MOQ', moqValue);

    // Remarks - always show empty like MOQ
    addTableRow('Remarks', '');

    // Download the PDF using blob method
    const fileName = `SAMPLE_STICKER_${sample.qualityName || 'STICKER'}_${new Date().toISOString().split('T')[0]}.pdf`;

    // Get PDF as blob
    const pdfBlob = doc.output('blob');

    // Create download link
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';

    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up blob URL after a delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);

    if (process.env.NODE_ENV === 'development') {
      console.log('PDF Generator - Sample sticker PDF downloaded directly:', fileName);
    }

  } catch (error) {
    console.error('PDF Generator - Error downloading sample sticker PDF:', error);
    if (typeof window !== 'undefined') {
      alert('Failed to download sticker PDF. Please try again.');
    }
    throw error;
  }
};