import { Order } from '../types';
import { getDisplayOrderId } from './helpers';

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
    address: 'Plot 37,38, Krishna Industrial Society, Opposite Umiya Residency, Near Milan Point, Bamroli - Vadod Road, Bamroli, Pandesara, Surat 394210',
    phone: '+91-9427988999',
    gstin: '24AAJHV2286E1Z0',
    email: 'viralfabrics@yahoo.com',
    website: 'www.viralfabrics.com',
  }
};

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '₹0.00';
  return `₹${Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-IN');
}

export function generateOrderHtml(order: Order, itemIndex: number = 0): string {
  const companyKey = (order as any).companyHeader || 'Viral Fabrics';
  const company = COMPANY_HEADERS[companyKey] || COMPANY_HEADERS['Viral Fabrics'];
  
  const items = order.items || [];
  const currentItem: any = items[itemIndex] || items[0] || {};
  const qualityName = typeof currentItem.quality === 'object' && currentItem.quality?.name
    ? currentItem.quality.name
    : (typeof currentItem.quality === 'string' ? currentItem.quality : 'N/A');

  const partyName = typeof order.party === 'object' && order.party?.name
    ? order.party.name
    : (typeof order.party === 'string' ? order.party : 'N/A');

  // Filter grey information by quality
  const qualityId = typeof currentItem.quality === 'object' ? currentItem.quality?._id : null;
  const greyList = (order.greyInformation || []).filter(g => {
    if (!qualityId || !g.quality) return true;
    const gQualId = typeof g.quality === 'object' ? (g.quality as any)._id : g.quality;
    return String(gQualId) === String(qualityId);
  });

  const millInputs = order.millInputs || [];
  const millOutputs = order.millOutputs || [];
  const dispatches = order.dispatches || [];

  // Totals calculations
  const totalGreighMtr = millInputs.reduce((sum, m) => sum + (m.greighMtr || 0), 0);
  const totalFinishedMtr = millOutputs.reduce((sum, m) => sum + (m.finishedMtr || 0), 0);
  const totalDispatchedMtr = dispatches.reduce((sum, d) => sum + (d.finishMtr || 0), 0);
  const totalSalesValue = dispatches.reduce((sum, d) => sum + (d.totalValue || (d.finishMtr || 0) * (d.saleRate || 0)), 0);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Sheet - ${order.orderId}</title>
      <style>
        @page {
          size: A4;
          margin: 12mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 9pt;
          line-height: 1.3;
          color: #1e293b;
          background: #ffffff;
          padding: 4mm;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .company-title {
          font-size: 16pt;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .company-sub {
          font-size: 8pt;
          color: #475569;
          margin-top: 2px;
        }
        .document-title {
          font-size: 11pt;
          font-weight: 700;
          color: #1e40af;
          text-transform: uppercase;
          margin-top: 6px;
          letter-spacing: 0.5px;
        }
        .grid-container {
          display: flex;
          flex-wrap: wrap;
          margin-bottom: 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          overflow: hidden;
        }
        .grid-cell {
          width: 50%;
          padding: 6px 10px;
          border-bottom: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
          display: flex;
        }
        .grid-cell:nth-child(2n) {
          border-right: none;
        }
        .grid-cell.full {
          width: 100%;
          border-right: none;
        }
        .label {
          font-size: 8pt;
          font-weight: 600;
          color: #64748b;
          width: 110px;
          flex-shrink: 0;
        }
        .value {
          font-size: 8.5pt;
          font-weight: 700;
          color: #0f172a;
        }
        .section-heading {
          font-size: 9.5pt;
          font-weight: 700;
          color: #0f172a;
          background: #f1f5f9;
          padding: 5px 8px;
          border-left: 4px solid #2563eb;
          margin-top: 10px;
          margin-bottom: 6px;
          border-radius: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
          font-size: 8pt;
        }
        th {
          background: #f8fafc;
          color: #334155;
          font-weight: 700;
          text-align: left;
          padding: 5px 8px;
          border: 1px solid #cbd5e1;
          font-size: 7.5pt;
          text-transform: uppercase;
        }
        td {
          padding: 5px 8px;
          border: 1px solid #e2e8f0;
          color: #0f172a;
        }
        tr:nth-child(even) td {
          background: #fafafa;
        }
        .totals-card {
          display: flex;
          justify-content: space-between;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 12px;
          margin-top: 12px;
        }
        .stat-box {
          text-align: center;
        }
        .stat-label {
          font-size: 7.5pt;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }
        .stat-val {
          font-size: 10pt;
          font-weight: 800;
          color: #0f172a;
          margin-top: 2px;
        }
        .footer {
          margin-top: 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-top: 12px;
          border-top: 1px dashed #cbd5e1;
        }
        .footer-text {
          font-size: 7.5pt;
          color: #94a3b8;
        }
        .signature-line {
          width: 140px;
          text-align: center;
          border-top: 1px solid #475569;
          padding-top: 4px;
          font-size: 8pt;
          font-weight: 700;
          color: #334155;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="company-title">${company.name}</div>
        <div class="company-sub">${company.address}</div>
        <div class="company-sub">Phone: ${company.phone} | GSTIN: ${company.gstin}</div>
        <div class="document-title">FABRIC ORDER CONFIRMATION SHEET</div>
      </div>

      <!-- Main Order Metadata -->
      <div class="grid-container">
        <div class="grid-cell">
          <span class="label">ORDER ID:</span>
          <span class="value">${getDisplayOrderId(order.orderId) || '-'}</span>
        </div>
        <div class="grid-cell">
          <span class="label">DATE:</span>
          <span class="value">${formatDate((order as any).arrivalDate || order.createdAt)}</span>
        </div>
        <div class="grid-cell">
          <span class="label">PARTY NAME:</span>
          <span class="value">${partyName}</span>
        </div>
        <div class="grid-cell">
          <span class="label">ORDER TYPE:</span>
          <span class="value" style="color: #2563eb;">${order.orderType || 'Dying'}</span>
        </div>
        <div class="grid-cell">
          <span class="label">PO NUMBER:</span>
          <span class="value">${getDisplayOrderId(order.poNumber) || '-'}</span>
        </div>
        <div class="grid-cell">
          <span class="label">STYLE NO:</span>
          <span class="value">${order.styleNo || '-'}</span>
        </div>
        <div class="grid-cell">
          <span class="label">QUALITY:</span>
          <span class="value" style="color: #059669;">${qualityName}</span>
        </div>
        <div class="grid-cell">
          <span class="label">DELIVERY DATE:</span>
          <span class="value">${formatDate(order.deliveryDate)}</span>
        </div>
        ${order.notes ? `
        <div class="grid-cell full">
          <span class="label">NOTES / SPECS:</span>
          <span class="value">${order.notes}</span>
        </div>
        ` : ''}
      </div>

      <!-- Rates & Pricing -->
      <div class="section-heading">ITEM PRICING & RATES</div>
      <table>
        <thead>
          <tr>
            <th>Item #</th>
            <th>Quality</th>
            <th>Meters / Qty</th>
            <th>Purchase Rate</th>
            <th>Mill Rate</th>
            <th>Sales Rate</th>
            <th>Total Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><b>${qualityName}</b></td>
            <td>${formatNumber(currentItem.quantity)} mtr</td>
            <td>${formatCurrency(currentItem.purchaseRate)}</td>
            <td>${formatCurrency(currentItem.millRate)}</td>
            <td>${formatCurrency(currentItem.salesRate)}</td>
            <td><b>${formatCurrency(currentItem.totalPrice || ((currentItem.quantity || 0) * (currentItem.salesRate || 0)))}</b></td>
          </tr>
        </tbody>
      </table>

      <!-- Grey Information -->
      ${greyList.length > 0 ? `
      <div class="section-heading">GREY INFORMATION</div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Challan No</th>
            <th>Pieces (Pcs)</th>
            <th>Quantity (Mtr)</th>
          </tr>
        </thead>
        <tbody>
          ${greyList.map(g => `
            <tr>
              <td>${formatDate(g.date)}</td>
              <td><b>${g.chalanNo || '-'}</b></td>
              <td>${formatNumber(g.numberOfPieces)} pcs</td>
              <td><b>${formatNumber(g.quantity)} mtr</b></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}

      <!-- Mill Inputs -->
      ${millInputs.length > 0 ? `
      <div class="section-heading">MILL INPUT DETAILS</div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Mill Name</th>
            <th>Challan No</th>
            <th>Greigh Mtr</th>
            <th>Pcs</th>
          </tr>
        </thead>
        <tbody>
          ${millInputs.map(m => `
            <tr>
              <td>${formatDate(m.millDate)}</td>
              <td><b>${typeof m.mill === 'object' && m.mill?.name ? m.mill.name : (m.mill || '-')}</b></td>
              <td>${m.chalanNo || '-'}</td>
              <td><b>${formatNumber(m.greighMtr)} mtr</b></td>
              <td>${formatNumber(m.pcs)} pcs</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}

      <!-- Mill Outputs -->
      ${millOutputs.length > 0 ? `
      <div class="section-heading">MILL OUTPUT DETAILS</div>
      <table>
        <thead>
          <tr>
            <th>Received Date</th>
            <th>Mill Bill No</th>
            <th>Finished Mtr</th>
            <th>Mill Rate</th>
            <th>Total Cost</th>
          </tr>
        </thead>
        <tbody>
          ${millOutputs.map(mo => `
            <tr>
              <td>${formatDate(mo.recdDate)}</td>
              <td><b>${mo.millBillNo || '-'}</b></td>
              <td><b>${formatNumber(mo.finishedMtr)} mtr</b></td>
              <td>${formatCurrency(mo.millRate)}</td>
              <td>${formatCurrency((mo.finishedMtr || 0) * (mo.millRate || 0))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}

      <!-- Dispatches -->
      ${dispatches.length > 0 ? `
      <div class="section-heading">DISPATCH & BILLING DETAILS</div>
      <table>
        <thead>
          <tr>
            <th>Dispatch Date</th>
            <th>Bill No</th>
            <th>Transport / LR</th>
            <th>Finish Mtr</th>
            <th>Sale Rate</th>
            <th>Total Value</th>
          </tr>
        </thead>
        <tbody>
          ${dispatches.map(d => `
            <tr>
              <td>${formatDate(d.dispatchDate)}</td>
              <td><b>${d.billNo || '-'}</b></td>
              <td>${d.transportNo || ''} ${d.lrNo ? `(LR: ${d.lrNo})` : ''}</td>
              <td><b>${formatNumber(d.finishMtr)} mtr</b></td>
              <td>${formatCurrency(d.saleRate)}</td>
              <td><b>${formatCurrency(d.totalValue || (d.finishMtr || 0) * (d.saleRate || 0))}</b></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}

      <!-- Summary Stats -->
      <div class="totals-card">
        <div class="stat-box">
          <div class="stat-label">Total Greigh</div>
          <div class="stat-val">${formatNumber(totalGreighMtr)} mtr</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Finished</div>
          <div class="stat-val">${formatNumber(totalFinishedMtr)} mtr</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Dispatched</div>
          <div class="stat-val" style="color: #059669;">${formatNumber(totalDispatchedMtr)} mtr</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Sales Value</div>
          <div class="stat-val" style="color: #2563eb;">${formatCurrency(totalSalesValue)}</div>
        </div>
      </div>

      <!-- Signatures Footer -->
      <div class="footer">
        <div class="footer-text">Generated via Viral Fabrics Mobile • ${new Date().toLocaleDateString('en-IN')}</div>
        <div class="signature-line">Authorized Signatory</div>
      </div>
    </body>
    </html>
  `;
}
