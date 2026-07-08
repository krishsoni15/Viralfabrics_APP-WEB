import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

interface StickerData {
  type: 'sample' | 'fabric' | 'grey';
  qualityCode?: string;
  qualityName: string;
  weaverName?: string;
  width?: number;
  gsm?: number;
  content?: string;
  count?: string;
  rxP?: string;
  danier?: string;
  moq?: string;
  remarks?: string;
  challanNumber?: string;
  piece?: number;
  meter?: number;
}

function generateStickerHtml(data: StickerData): string {
  const widthVal = data.width ? `${data.width}"` : '-';
  const countVal = data.count || data.danier || '';
  const gsmVal = data.gsm ? String(data.gsm) : '-';
  const rxPVal = data.rxP || '-';
  const contentVal = data.content || '-';
  const moqVal = data.moq || '';

  let headerHtml = '';
  let tableContent = '';

  if (data.type === 'grey') {
    // Grey sticker: Brand + slogan, matches fabric sticker layout
    headerHtml = `
      <div class="header">
        <div class="brand">VIRAL FABRICS</div>
        <div class="slogan">MPO &amp; SUPPLIER OF: ALL TYPE OF EXPORT</div>
      </div>
    `;
    tableContent = `
      <tr>
        <td class="label">Quality Code</td>
        <td class="value" colspan="3">${data.qualityCode || '-'}</td>
      </tr>
      <tr>
        <td class="label">Quality Name</td>
        <td class="value" colspan="3">${data.qualityName || '-'}</td>
      </tr>
      <tr>
        <td class="label">Width (Inch)</td>
        <td class="value">${widthVal}</td>
        <td class="right-label">Count</td>
        <td class="right-value">${countVal}</td>
      </tr>
      <tr>
        <td class="label">GSM</td>
        <td class="value">${gsmVal}</td>
        <td class="right-label">R x P</td>
        <td class="right-value">${rxPVal}</td>
      </tr>
      <tr>
        <td class="label">Content</td>
        <td class="value">${contentVal}</td>
        <td class="right-label">MOQ</td>
        <td class="right-value">${moqVal}</td>
      </tr>
      <tr>
        <td class="label">Remarks</td>
        <td class="value" colspan="3">${data.remarks || ''}</td>
      </tr>
    `;
  } else if (data.type === 'fabric') {
    // Fabric sticker: Brand + slogan, matches website
    headerHtml = `
      <div class="header">
        <div class="brand">VIRAL FABRICS</div>
        <div class="slogan">MPO &amp; SUPPLIER OF: ALL TYPE OF EXPORT</div>
      </div>
    `;
    tableContent = `
      <tr>
        <td class="label">Quality Code</td>
        <td class="value" colspan="3">${data.qualityCode || '-'}</td>
      </tr>
      <tr>
        <td class="label">Quality Name</td>
        <td class="value" colspan="3">${data.qualityName || '-'}</td>
      </tr>
      <tr>
        <td class="label">Width (Inch)</td>
        <td class="value">${widthVal}</td>
        <td class="right-label">Count</td>
        <td class="right-value">${countVal}</td>
      </tr>
      <tr>
        <td class="label">GSM</td>
        <td class="value">${gsmVal}</td>
        <td class="right-label">R x P</td>
        <td class="right-value">${rxPVal}</td>
      </tr>
      <tr>
        <td class="label">Content</td>
        <td class="value">${contentVal}</td>
        <td class="right-label">MOQ</td>
        <td class="right-value">${moqVal}</td>
      </tr>
      <tr>
        <td class="label">Remarks</td>
        <td class="value" colspan="3">${data.remarks || ''}</td>
      </tr>
    `;
  } else {
    // Sample sticker: Brand + slogan, matches website
    headerHtml = `
      <div class="header">
        <div class="brand">VIRAL FABRICS</div>
        <div class="slogan">MFG &amp; SUPPLIER OF ALL TYPES OF EXPORT FABRICS</div>
      </div>
    `;
    tableContent = `
      <tr>
        <td class="label">Quality Name</td>
        <td class="value" colspan="3">${data.qualityName || '-'}</td>
      </tr>
      ${data.weaverName ? `
      <tr>
        <td class="label">Weaver</td>
        <td class="value" colspan="3">${data.weaverName}</td>
      </tr>
      ` : ''}
      <tr>
        <td class="label">Width (Inch)</td>
        <td class="value">${widthVal}</td>
        <td class="right-label">Count</td>
        <td class="right-value">${countVal}</td>
      </tr>
      <tr>
        <td class="label">GSM</td>
        <td class="value">${gsmVal}</td>
        <td class="right-label">R x P</td>
        <td class="right-value">${rxPVal}</td>
      </tr>
      <tr>
        <td class="label">Content</td>
        <td class="value">${contentVal}</td>
        <td class="right-label">MOQ</td>
        <td class="right-value">${moqVal}</td>
      </tr>
      <tr>
        <td class="label">Remarks</td>
        <td class="value" colspan="3">${data.remarks || ''}</td>
      </tr>
    `;
  }

  const isGrey = data.type === 'grey';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page {
    size: 100mm 50mm;
    margin: 0;
  }
  html, body {
    width: 100mm;
    height: 50mm;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #fff;
    font-family: 'Helvetica', 'Arial', sans-serif;
  }
  .sticker {
    width: 97mm;
    height: 47mm;
    margin: 1.5mm;
    border: 0.6mm solid #000;
    background: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .header {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 1.2mm 0 0.8mm 0;
    border-bottom: 0.5mm solid #000;
  }
  .grey-header {
    padding: 1.5mm 0 1.2mm 0;
  }
  .brand {
    font-size: 10.5pt;
    font-weight: bold;
    color: #000;
    text-align: center;
    line-height: 1.2;
    text-transform: uppercase;
  }
  .grey-brand {
    font-size: 14pt;
  }
  .slogan {
    font-size: 4.2pt;
    font-weight: bold;
    color: #000;
    text-align: center;
    line-height: 1.2;
    margin-top: 0.5mm;
    text-transform: uppercase;
  }
  .table-container {
    width: 100%;
    flex: 1;
    display: flex;
  }
  table {
    width: 100%;
    height: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  td {
    border-bottom: 0.5mm solid #000;
    padding: 0 0.8mm;
    font-weight: bold;
    vertical-align: middle;
    color: #000;
    text-align: left;
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-size: 7.5pt;
  }
  tr:last-child td {
    border-bottom: none;
  }
  .label {
    width: 29%;
    border-right: 0.5mm solid #000;
    font-size: 7.5pt;
  }
  .value {
    border-right: 0.5mm solid #000;
    font-size: 7.5pt;
  }
  .right-label {
    width: 14%;
    border-right: 0.5mm solid #000;
    font-size: 7.5pt;
  }
  .right-value {
    width: 18%;
    font-size: 7.5pt;
  }
  td[colspan="3"].value {
    border-right: none;
  }


</style>
</head>
<body>
<div class="sticker">
  ${headerHtml}
  <div class="table-container">
    <table>
      ${tableContent}
    </table>
  </div>
</div>
</body>
</html>`;
}

export async function generateStickerPdf(data: StickerData, filename: string): Promise<{ uri: string; base64?: string }> {
  const html = generateStickerHtml(data);
  const result = await Print.printToFileAsync({
    html,
    base64: true,
    width: 283.46,  // 100mm in points (72 points per inch)
    height: 141.73, // 50mm in points
  });

  let finalUri = result.uri;
  let base64 = result.base64;

  if (Platform.OS !== 'web') {
    try {
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      if (Platform.OS === 'android' && base64) {
        // Android print framework locks files in the temp spooler folder.
        // Writing the returned base64 string directly to our cache folder bypasses the lock cleanly.
        await FileSystem.writeAsStringAsync(dest, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        finalUri = dest;
      } else {
        // iOS or fallback: copy the temporary print file to cache
        await FileSystem.copyAsync({ from: result.uri, to: dest });
        finalUri = dest;
      }
    } catch (err) {
      console.warn('Failed to cache generated sticker PDF:', err);
    }
  }

  return { uri: finalUri, base64 };
}
