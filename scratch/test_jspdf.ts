import { generateSampleStickerPDF } from '../lib/pdfGenerator';

try {
  console.log('Generating sticker PDF...');
  const result = generateSampleStickerPDF({
    qualityName: 'Test Quality',
    weaverName: 'Test Weaver',
    width: 60,
    gsm: 200,
    content: '100% Cotton',
    count: 30,
    rxP: '120/80',
    danier: '150D'
  });
  console.log('Success! Result length:', result.length);
  console.log('Result start:', result.substring(0, 100));
} catch (error) {
  console.error('Error generating PDF:', error);
}
