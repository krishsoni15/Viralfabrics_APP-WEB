import { PurchaseOrder } from '../types';
import { formatDate, getDisplayOrderId } from './helpers';

// Company header configs mapping
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

export const generatePoHtml = (po: PurchaseOrder) => {
  const companyConfig = COMPANY_HEADERS[po.companyHeader] || COMPANY_HEADERS['Viral Fabrics'];
  const displayId = getDisplayOrderId(po.poNumber);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Purchase Order ${displayId}</title>
      <style>
        body { 
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
          font-size: 11pt; 
          padding: 20px; 
          color: #000; 
          margin: 0;
          box-sizing: border-box;
        }
        h1 { 
          text-align: center; 
          margin: 0 0 5px 0; 
          font-size: 22pt; 
          font-weight: bold; 
          letter-spacing: 1px;
        }
        .subtitle { 
          text-align: center; 
          font-size: 10pt; 
          margin-bottom: 30px; 
          line-height: 1.4;
        }
        .po-title {
          text-align: center;
          font-size: 16pt;
          font-weight: bold;
          margin-bottom: 20px;
          text-transform: uppercase;
          border-bottom: 2px solid #000;
          display: inline-block;
          padding-bottom: 5px;
        }
        .title-wrapper {
          text-align: center;
          margin-bottom: 20px;
        }
        .header-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 20px; 
        }
        .header-table td { 
          border: 1.5px solid #000; 
          padding: 10px; 
          vertical-align: top; 
          width: 50%; 
        }
        .field-row {
          margin-bottom: 6px;
        }
        .field-label {
          font-weight: bold;
          display: inline-block;
          width: 110px;
        }
        .main-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 20px; 
        }
        .main-table th, .main-table td { 
          border: 1.5px solid #000; 
          padding: 10px; 
          text-align: left; 
        }
        .main-table th { 
          background-color: #f1f5f9; 
          font-weight: bold; 
          text-transform: uppercase;
          font-size: 10pt;
        }
        .notes-section { 
          border: 1.5px solid #000; 
          padding: 15px; 
          min-height: 80px; 
          margin-bottom: 40px; 
        }
        .notes-title {
          font-weight: bold;
          margin-bottom: 8px;
          font-size: 11pt;
        }
        .signature-section { 
          display: flex; 
          justify-content: space-between; 
          margin-top: 50px; 
        }
        .signature-box { 
          text-align: center; 
          width: 40%; 
        }
        .signature-line { 
          border-top: 1.5px solid #000; 
          margin-top: 50px; 
          padding-top: 8px; 
          font-weight: bold; 
        }
      </style>
    </head>
    <body>
      <h1>${companyConfig.name}</h1>
      <div class="subtitle">
        ${companyConfig.address}<br/>
        Phone: ${companyConfig.phone} | GSTIN: <strong>${companyConfig.gstin}</strong><br/>
        Email: ${companyConfig.email} | Web: ${companyConfig.website}
      </div>

      <div class="title-wrapper">
        <div class="po-title">Purchase Order</div>
      </div>

      <table class="header-table">
        <tr>
          <td>
            <div class="field-row"><span class="field-label">Supplier:</span> <strong>${po.supplierName || '—'}</strong></div>
            <div class="field-row"><span class="field-label">Address:</span> ${po.supplierAddress || '—'}</div>
            <div class="field-row"><span class="field-label">GSTIN:</span> ${po.supplierGstin || '—'}</div>
            <div style="margin-top: 10px;">
              <div class="field-row"><span class="field-label">Broker:</span> ${po.brokerName || '—'}</div>
              <div class="field-row"><span class="field-label">Broker Phone:</span> ${po.brokerPhone || '—'}</div>
            </div>
          </td>
          <td>
            <div class="field-row"><span class="field-label">PO Number:</span> <strong>#${displayId}</strong></div>
            <div class="field-row"><span class="field-label">PO Date:</span> <strong>${formatDate(po.poDate) || '—'}</strong></div>
            <div style="margin-top: 15px;">
              <div class="field-row"><span class="field-label">Delivery:</span> ${po.delivery || '—'}</div>
              <div class="field-row"><span class="field-label">Payment Terms:</span> ${po.paymentTerms ? po.paymentTerms.replace(/\n/g, '<br/>') : '—'}</div>
            </div>
          </td>
        </tr>
      </table>

      <table class="main-table">
        <thead>
          <tr>
            <th style="width: 5%;">Sr.</th>
            <th style="width: 40%;">Quality / Description</th>
            <th style="width: 15%;">Pcs / Mtr</th>
            <th style="width: 15%;">Rate</th>
            <th style="width: 25%;">Specifications</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center;">1</td>
            <td><strong>${po.quality || '—'}</strong></td>
            <td>${po.pcsMtr || '—'}</td>
            <td><strong>${po.rate ? (/gst/i.test(po.rate) ? po.rate : `${po.rate} + GST`) : '—'}</strong></td>
            <td>
              ${po.specs?.finishGsm ? `<div class="field-row"><strong>Finish GSM:</strong> ${po.specs.finishGsm}</div>` : ''}
              ${po.specs?.greyWidth ? `<div class="field-row"><strong>Grey Width:</strong> ${po.specs.greyWidth}</div>` : ''}
              ${po.specs?.finishWidth ? `<div class="field-row"><strong>Finish Width:</strong> ${po.specs.finishWidth}</div>` : ''}
              ${po.specs?.weight ? `<div class="field-row"><strong>Weight:</strong> ${po.specs.weight}</div>` : ''}
              ${!po.specs?.finishGsm && !po.specs?.greyWidth && !po.specs?.finishWidth && !po.specs?.weight ? '—' : ''}
            </td>
          </tr>
        </tbody>
      </table>

      ${po.notes ? `
      <div class="notes-section">
        <div class="notes-title">Notes / Terms:</div>
        <div>${po.notes.replace(/\\n/g, '<br/>')}</div>
      </div>
      ` : ''}

      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line">Receiver's Signature / Stamp</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">For ${companyConfig.name}</div>
        </div>
      </div>
    </body>
    </html>
  `;
};
