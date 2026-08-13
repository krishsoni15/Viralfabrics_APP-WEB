import { PurchaseOrder } from '../types';

const COMPANY_HEADERS: Record<string, {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  email: string;
  website: string;
}> = {
  'Viral Fabrics': {
    name: 'VIRAL FABRICS',
    address: 'PLOT NO.37-38, KRISHNA IND.SOC., OPP.UMIYA RESI. BAMROLI, PANDESARA, SURAT 394210',
    phone: '094279 88999',
    gstin: '24AXYPP4119J1ZW',
    email: 'viralfabrics@yahoo.com',
    website: 'www.viralfabrics.com',
  },
  'Viral Enterprise': {
    name: 'VIRAL ENTERPRISE',
    address: 'Plot 37,38 , Krishna Industrial. Society, Opposite Umiya Residency ,Near Milan Point, Bamroli - Vadod Road, Bamroli, Pandesara, Surat 394210',
    phone: '+91-9427988999',
    gstin: '24AAJHV2286E1Z0',
    email: 'viralfabrics@yahoo.com',
    website: 'www.viralfabrics.com',
  }
};

function formatLeadTime(val: string | undefined | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^\d+$/.test(trimmed)) {
    return `${trimmed} Days`;
  }
  return trimmed;
}

function formatDateDDMMYYYY(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function cleanPoNumber(poNumber?: string | null): string {
  if (!poNumber) return '';
  const idStr = String(poNumber).trim();
  const parts = idStr.split(/[\/\-\s]+/);
  const lastPart = parts[parts.length - 1];
  if (lastPart && /^\d+$/.test(lastPart)) {
    return lastPart;
  }
  return idStr.replace(/^FY\s*-?\s*/i, '');
}

function splitTextIntoLines(text: string | undefined | null, maxChars: number = 75): string[] {
  if (!text) return [];
  const lines: string[] = [];
  const rawLines = text.split('\n');
  for (const line of rawLines) {
    if (line.length <= maxChars) {
      lines.push(line);
    } else {
      let currentLine = '';
      const words = line.split(' ');
      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxChars) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
    }
  }
  return lines;
}

export const generatePoHtml = (po: PurchaseOrder) => {
  const companyConfig = COMPANY_HEADERS[po.companyHeader] || COMPANY_HEADERS['Viral Fabrics'];
  const displayId = cleanPoNumber(po.poNumber);
  const addressLines = splitTextIntoLines(po.supplierAddress);
  const addressHtmlRows = addressLines.map(line => `
    <div class="row" style="margin-bottom: 8.5mm;">
      <div class="value underline-fill" style="font-weight: bold;">${line}</div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Purchase Order ${displayId}</title>
      <style>
        @page {
          size: A4;
          margin: 10mm 15mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 9.5pt;
          line-height: 1.2;
          color: #000;
          background: #fff;
        }
        .container {
          width: 100%;
        }
        .header {
          text-align: center;
          margin-top: 1mm;
          margin-bottom: 3.5mm;
        }
        .company-name {
          font-size: 16pt;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 1mm;
          letter-spacing: 0.5px;
        }
        .company-address {
          font-size: 8.5pt;
          line-height: 1.3;
          max-width: 150mm;
          margin: 0 auto 1mm auto;
        }
        .company-phone {
          font-size: 8.5pt;
        }
        .title-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 2mm;
          position: relative;
          height: 5.5mm;
          width: 100%;
        }
        .gstin-box {
          font-size: 9.5pt;
          font-weight: normal;
        }
        .gstin-value {
          font-weight: bold;
          text-decoration: underline;
          text-underline-offset: 1mm;
          text-decoration-thickness: 0.4mm;
        }
        .po-title {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          font-size: 13pt;
          font-weight: bold;
        }
        .section-divider-thick {
          border-top: 0.35mm solid #000;
          margin-top: 2.5mm;
          margin-bottom: 3.5mm;
          width: 100%;
        }
        .row {
          display: flex;
          align-items: baseline;
          margin-bottom: 4.5mm;
          width: 100%;
        }
        .split-row {
          justify-content: space-between;
        }
        .left-field {
          display: flex;
          align-items: baseline;
        }
        .right-field {
          display: flex;
          align-items: baseline;
        }
        .label {
          font-weight: normal;
          margin-right: 2mm;
          white-space: nowrap;
        }
        .colon {
          font-weight: normal;
          margin-right: 2mm;
        }
        .value {
          font-weight: bold;
          min-height: 4.5mm;
        }
        .underline-fill {
          flex-grow: 1;
          border-bottom: 0.3mm solid #000;
          padding-bottom: 0.5mm;
        }
        .lined-section {
          margin-bottom: 3mm;
          width: 100%;
        }
        .lined-label {
          font-size: 9.5pt;
          font-weight: normal;
          margin-bottom: 1mm;
        }
        .notebook-lines {
          line-height: 6.5mm;
          font-weight: bold;
          background-image: linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px);
          background-size: 100% 6.5mm;
          background-position: 0 5.5mm;
          padding-bottom: 1px;
        }
        .specs-table {
          width: 75mm;
          border-collapse: collapse;
          border: 0.35mm solid #000;
          margin-bottom: 4mm;
          font-size: 8.5pt;
        }
        .specs-table td {
          border: 0.35mm solid #000;
          height: 6.5mm;
          vertical-align: middle;
          padding: 0 2mm;
          font-weight: bold;
        }
        .specs-label {
          width: 30mm;
        }
        .specs-val {
          width: 45mm;
        }
        .signature-section {
          display: flex;
          justify-content: space-between;
          margin-top: 6mm;
          width: 100%;
        }
        .signature-box {
          width: 40%;
          text-align: center;
        }
        .signature-line {
          border-top: 0.35mm solid #000;
          padding-top: 2mm;
          font-weight: bold;
          font-size: 9.5pt;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="company-name">${companyConfig.name}</div>
          <div class="company-address">${companyConfig.address}</div>
          <div class="company-phone">Phone: ${companyConfig.phone}</div>
        </div>

        <!-- GSTIN & Title -->
        <div class="title-row">
          <div class="gstin-box">GSTIN : <span class="gstin-value">${companyConfig.gstin}</span></div>
          <div class="po-title">PURCHASE ORDER</div>
        </div>

        <div class="section-divider-thick"></div>

        <!-- PO Number & Date -->
        <div class="row split-row">
          <div class="left-field" style="width: 70mm;">
            <span class="label" style="width: 17mm;">PO No. :</span>
            <span class="value" style="width: 45mm; border-bottom: 0.3mm solid #000; display: inline-block;">${displayId}</span>
          </div>
          <div class="right-field" style="width: 50mm; display: flex; justify-content: flex-end;">
            <span class="label" style="margin-right: 1mm;">Date :</span>
            <span class="value" style="width: 32mm; border-bottom: 0.3mm solid #000; display: inline-block;">${formatDateDDMMYYYY(po.poDate)}</span>
          </div>
        </div>

        <!-- Broker Name -->
        <div class="row">
          <span class="label" style="width: 28mm;">Broker Name</span>
          <span class="colon" style="width: 3mm;">:</span>
          <span class="value underline-fill">${po.brokerName || ''}</span>
        </div>

        <!-- Mobile No -->
        <div class="row">
          <span class="label" style="width: 28mm;">Mobile No.</span>
          <span class="colon" style="width: 3mm;">:</span>
          <span class="value underline-fill">${po.brokerPhone || ''}</span>
        </div>

        <div class="section-divider-thick"></div>

        <!-- Supplier Name -->
        <div class="row">
          <span class="label" style="width: 28mm;">Supplier Name</span>
          <span class="colon" style="width: 3mm;">:</span>
          <span class="value underline-fill">${po.supplierName || ''}</span>
        </div>

        <!-- Supplier Address -->
        ${addressHtmlRows}

        <!-- Supplier GSTIN & Mobile -->
        <div class="row split-row">
          <div class="left-field" style="width: 70mm;">
            <span class="label" style="width: 16mm;">GSTIN</span>
            <span class="colon" style="width: 3mm;">:</span>
            <span class="value underline-fill" style="width: 50mm; display: inline-block;">${po.supplierGstin || ''}</span>
          </div>
          <div class="right-field" style="width: 95mm; display: flex; justify-content: flex-end;">
            <span class="label" style="width: 25mm; display: inline-block;">Mobile No.</span>
            <span class="colon" style="width: 2mm; display: inline-block;">:</span>
            <span class="value underline-fill" style="width: 68mm; display: inline-block;">${po.supplierPhone || ''}</span>
          </div>
        </div>

        <div class="section-divider-thick"></div>

        <!-- Quality -->
        <div class="row">
          <span class="label" style="width: 18mm;">Quality</span>
          <span class="colon" style="width: 3mm;">:</span>
          <span class="value underline-fill">${po.quality || ''}</span>
        </div>

        <div class="section-divider-thick"></div>

        <!-- Pcs/Mtr & Delivery -->
        <div class="row split-row">
          <div class="left-field" style="width: 70mm;">
            <span class="label" style="width: 18mm; display: inline-block;">Pcs/Mtr</span>
            <span class="colon" style="width: 2mm; display: inline-block;">:</span>
            <span class="value" style="width: 45mm; border-bottom: 0.3mm solid #000; display: inline-block;">${po.pcsMtr || ''}</span>
          </div>
          <div class="right-field" style="width: 95mm; display: flex; justify-content: flex-end;">
            <span class="label" style="width: 18mm; display: inline-block;">Delivery</span>
            <span class="colon" style="width: 2mm; display: inline-block;">:</span>
            <span class="value" style="width: 73mm; border-bottom: 0.3mm solid #000; display: inline-block;">${po.delivery || ''}</span>
          </div>
        </div>

        <!-- Rate & Greigh Mtr -->
        <div class="row split-row">
          <div class="left-field" style="width: 70mm;">
            <span class="label" style="width: 18mm; display: inline-block;">Rate</span>
            <span class="colon" style="width: 2mm; display: inline-block;">:</span>
            <span class="value" style="width: 45mm; border-bottom: 0.3mm solid #000; display: inline-block;">${po.rate ? (/gst/i.test(po.rate) ? po.rate : `${po.rate} + GST`) : ''}</span>
          </div>
          <div class="right-field" style="width: 95mm; display: flex; justify-content: flex-end;">
            <span class="label" style="width: 18mm; display: inline-block;">Greigh Mtr</span>
            <span class="colon" style="width: 2mm; display: inline-block;">:</span>
            <span class="value" style="width: 73mm; border-bottom: 0.3mm solid #000; display: inline-block;">${po.greighMtr || ''}</span>
          </div>
        </div>

        <!-- Lead Time -->
        <div class="row split-row">
          <div class="left-field" style="width: 70mm;">
          </div>
          <div class="right-field" style="width: 95mm; display: flex; justify-content: flex-end;">
            <span class="label" style="width: 18mm; display: inline-block;">Lead Time</span>
            <span class="colon" style="width: 2mm; display: inline-block;">:</span>
            <span class="value" style="width: 73mm; border-bottom: 0.3mm solid #000; display: inline-block;">${formatLeadTime(po.greighLeadTime)}</span>
          </div>
        </div>

        <!-- Payment Terms -->
        <div class="lined-section">
          <div class="lined-label">Payment Terms :</div>
          <div class="notebook-lines" style="min-height: 6.5mm;">
            ${po.paymentTerms ? po.paymentTerms.replace(/\n/g, '<br/>') : ''}
          </div>
        </div>

        <div class="section-divider-thick"></div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4mm; width: 100%;">
          <!-- Specs Table -->
          <table class="specs-table" style="margin-bottom: 0; margin-right: 5mm;">
            <tr>
              <td class="specs-label">Finish GSM:</td>
              <td class="specs-val">${po.specs?.finishGsm || ''}</td>
            </tr>
            <tr>
              <td class="specs-label">Grey Width:</td>
              <td class="specs-val">${po.specs?.greyWidth || ''}</td>
            </tr>
            <tr>
              <td class="specs-label">Finish Width:</td>
              <td class="specs-val">${po.specs?.finishWidth || ''}</td>
            </tr>
            <tr>
              <td class="specs-label">Weight:</td>
              <td class="specs-val">${po.specs?.weight || ''}</td>
            </tr>
          </table>

          ${(po.images || []).length === 1 ? `
            <div style="flex-grow: 1; display: flex; justify-content: center; align-items: center; max-width: 95mm;">
              <img src="${po.images?.[0] || ''}" style="width: 44mm; height: 26mm; object-fit: contain; background-color: #f8fafc; border: 0.3mm solid #ccc; border-radius: 1.5mm;" />
            </div>
          ` : `
            <div style="flex-grow: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; max-width: 95mm;">
              ${(po.images || []).map(img => `
                <img src="${img}" style="width: 100%; height: 26mm; object-fit: contain; background-color: #f8fafc; border: 0.3mm solid #ccc; border-radius: 1.5mm;" />
              `).join('')}
            </div>
          `}
        </div>

        <!-- Notes -->
        <div class="lined-section">
          <div class="lined-label">Notes :</div>
          <div class="notebook-lines" style="min-height: calc(7.5mm * 4);">
            ${po.notes ? po.notes.replace(/\r?\n/g, '<br/>').replace(/\\n/g, '<br/>') : ''}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
