const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'app/(pages)/(dashboard)/grey-materials/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// Replace sort keys
content = content.replace(/case 'gsm':/g, "case 'piece':");
content = content.replace(/aValue = a\.gsm \|\| 0;/g, "aValue = a.piece || 0;");
content = content.replace(/bValue = b\.gsm \|\| 0;/g, "bValue = b.piece || 0;");

content = content.replace(/case 'weight':/g, "case 'meter':");
content = content.replace(/aValue = a\.weight \|\| 0;/g, "aValue = a.meter || 0;");
content = content.replace(/bValue = b\.weight \|\| 0;/g, "bValue = b.meter || 0;");

content = content.replace(/case 'greighRate':/g, "case 'challanNumber':");
content = content.replace(/aValue = a\.greighRate \|\| 0;/g, "aValue = a.challanNumber || '';");
content = content.replace(/bValue = b\.greighRate \|\| 0;/g, "bValue = b.challanNumber || '';");

// In handleStickerDownload
content = content.replace(/width: greyMaterial\.finishWidth \|\| undefined,/g, "width: greyMaterial.meter || undefined,");
content = content.replace(/gsm: greyMaterial\.gsm \|\| undefined,/g, "gsm: greyMaterial.piece || undefined,");
content = content.replace(/content: greyMaterial\.content \|\| undefined,/g, "content: undefined,");
content = content.replace(/count: greyMaterial\.danier \|\| undefined,/g, "count: greyMaterial.challanNumber || undefined,");
content = content.replace(/rxP: greyMaterial\.reed && greyMaterial\.pick \? `\$\{greyMaterial\.reed\}\/\$\{greyMaterial\.pick\}` : undefined,/g, "rxP: undefined,");

// In currentStickerGreyMaterial sticker download
content = content.replace(/width: currentStickerGreyMaterial\.finishWidth \|\| undefined,/g, "width: currentStickerGreyMaterial.meter || undefined,");
content = content.replace(/gsm: currentStickerGreyMaterial\.gsm \|\| undefined,/g, "gsm: currentStickerGreyMaterial.piece || undefined,");
content = content.replace(/content: currentStickerGreyMaterial\.content \|\| undefined,/g, "content: undefined,");
content = content.replace(/count: currentStickerGreyMaterial\.danier \|\| undefined,/g, "count: currentStickerGreyMaterial.challanNumber || undefined,");
content = content.replace(/rxP: currentStickerGreyMaterial\.reed && currentStickerGreyMaterial\.pick \? `\$\{currentStickerGreyMaterial\.reed\}\/\$\{currentStickerGreyMaterial\.pick\}` : undefined,/g, "rxP: undefined,");

// Export to CSV headers
content = content.replace(/const headers = \['Quality Code', 'Quality Name', 'Weaver', 'Weaver Quality', 'GSM', 'Content', 'Danier', 'Weight', 'Rate', 'Width'\];/g, "const headers = ['Quality Code', 'Quality Name', 'Weaver', 'Challan Number', 'Piece', 'Meter'];");

// Export to CSV mapped data
content = content.replace(/f\.gsm,/g, "f.piece,");
content = content.replace(/f\.content,/g, "f.meter,");
content = content.replace(/f\.danier,/g, "'' /* empty */,");
content = content.replace(/f\.weight,/g, "'' /* empty */,");
content = content.replace(/f\.greighRate,/g, "'' /* empty */,");
content = content.replace(/f\.finishWidth/g, "'' /* empty */");

// Export to text mapping
content = content.replace(/`   GSM: \$\{f\.gsm \|\| 'N\/A'\}`/g, "`   Piece: ${f.piece || 'N/A'}`");
content = content.replace(/`   Weight: \$\{f\.weight \? f\.weight \+ ' KG' : 'N\/A'\}`/g, "`   Meter: ${f.meter || 'N/A'}`");
content = content.replace(/`   Rate: \$\{f\.greighRate \? '₹' \+ f\.greighRate : 'N\/A'\}`/g, "");
content = content.replace(/`   Width: \$\{f\.finishWidth \|\| 'N\/A'\}`/g, "");

// Table missing elements that I missed before
content = content.replace(/greyMaterial\.greighWidth > 0 \? greyMaterial\.greighWidth : '-'/g, "greyMaterial.piece > 0 ? greyMaterial.piece : '-'");
content = content.replace(/greyMaterial\.finishWidth > 0 \? greyMaterial\.finishWidth : '-'/g, "greyMaterial.meter > 0 ? greyMaterial.meter : '-'");

// Advanced filters missing ones
content = content.replace(/minGsm/g, "minPiece");
content = content.replace(/maxGsm/g, "maxPiece");
content = content.replace(/minWeight/g, "minMeter");
content = content.replace(/maxWeight/g, "maxMeter");
content = content.replace(/minRate/g, "minChallan");
content = content.replace(/maxRate/g, "maxChallan");
content = content.replace(/minWidth/g, "ignored_minWidth");
content = content.replace(/maxWidth/g, "ignored_maxWidth");

content = content.replace(/greyMaterial\.greighRate/g, "greyMaterial.challanNumber");
content = content.replace(/f\.greighRate/g, "f.challanNumber");
content = content.replace(/greyMaterial\.rack/g, "greyMaterial.challanNumber");

fs.writeFileSync(pagePath, content);
console.log('Fixed TS compilation errors');
