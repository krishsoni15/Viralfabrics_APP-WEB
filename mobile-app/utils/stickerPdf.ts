import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

interface StickerData {
  qualityName: string;
  weaverName?: string;
  width?: number;
  gsm?: number;
  content?: string;
  count?: string;
  rxP?: string;
  danier?: string;
  rack?: string;
}

function generateStickerHtml(data: StickerData): string {
  const widthVal = data.width ? `${data.width}"` : '-';
  const countVal = data.count || data.danier || '';
  const gsmVal = data.gsm ? String(data.gsm) : '-';
  const rxPVal = data.rxP || '-';
  const contentVal = data.content || '-';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica', 'Arial', sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: #f0f0f0;
    padding: 10px;
  }
  .sticker {
    width: 100mm;
    height: 50mm;
    border: 1.5px solid #000;
    border-radius: 2mm;
    padding: 3mm 2mm;
    position: relative;
    background: #fff;
    overflow: hidden;
  }
  .brand {
    text-align: center;
    font-size: 10.5pt;
    font-weight: bold;
    letter-spacing: 0.5px;
    margin-bottom: 1mm;
  }
  .slogan {
    text-align: center;
    font-size: 4.2pt;
    font-weight: bold;
    margin-bottom: 2mm;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5pt;
  }
  td {
    border: 0.5px solid #000;
    padding: 1.2mm 0.8mm;
    font-weight: bold;
  }
  .label {
    width: 28%;
    font-weight: bold;
  }
  .value {
    width: 32%;
    font-weight: bold;
  }
  .right-label {
    width: 16%;
    font-weight: bold;
    text-align: left;
  }
  .right-value {
    width: 18%;
    font-weight: bold;
    text-align: left;
  }
  .divider-row td {
    padding: 0;
    height: 0.5px;
  }
</style>
</head>
<body>
<div class="sticker">
  <div class="brand">VIRAL FABRICS</div>
  <div class="slogan">MFG &amp; SUPPLIER OF ALL TYPES OF EXPORT FABRICS</div>
  <table>
    <tr>
      <td class="label">Quality Name</td>
      <td class="value" colspan="3">${data.qualityName || '-'}</td>
    </tr>
    ${data.weaverName ? `<tr><td class="label">Weaver</td><td class="value" colspan="3">${data.weaverName}</td></tr>` : ''}
    <tr>
      <td class="label">Width (Inch)</td>
      <td class="value">${widthVal}</td>
      <td class="right-label">Count</td>
      <td class="right-value">${countVal || '-'}</td>
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
      <td class="right-value"></td>
    </tr>
    <tr>
      <td class="label">Remarks</td>
      <td class="value" colspan="3"></td>
    </tr>
  </table>
</div>
</body>
</html>`;
}

export async function generateStickerPdf(data: StickerData, filename: string): Promise<{ uri: string; base64?: string }> {
  const html = generateStickerHtml(data);
  const result = await Print.printToFileAsync({ html, base64: true });

  let base64: string | undefined;
  if (Platform.OS === 'android') {
    base64 = result.base64;
  } else {
    const dest = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.moveAsync({ from: result.uri, to: dest });
    return { uri: dest };
  }

  return { uri: result.uri, base64 };
}
