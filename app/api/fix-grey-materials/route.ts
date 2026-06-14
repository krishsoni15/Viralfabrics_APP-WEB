import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const componentsDir = path.join(process.cwd(), 'app/(pages)/(dashboard)/grey-materials/components');
    
    // 1. Rename files
    const files = fs.readdirSync(componentsDir);
    for (const file of files) {
      if (file.includes('Fabric')) {
        const oldPath = path.join(componentsDir, file);
        const newPath = path.join(componentsDir, file.replace(/Fabric/g, 'GreyMaterial'));
        
        // Only rename if the new file doesn't exist, or if it does, overwrite it
        if (oldPath !== newPath) {
          if (fs.existsSync(newPath) && file !== 'FabricForm.tsx' && file !== 'FabricFormContent.tsx') {
            fs.unlinkSync(newPath); // Remove my old nested ones if they conflict
          }
          fs.renameSync(oldPath, newPath);
        }
      }
    }

    // 2. String replace inside components
    const newFiles = fs.readdirSync(componentsDir);
    for (const file of newFiles) {
      if (file.endsWith('.tsx')) {
        const filePath = path.join(componentsDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Standard fabric -> greyMaterial replacements
        content = content.replace(/fabric/g, 'greyMaterial');
        content = content.replace(/Fabric/g, 'GreyMaterial');
        content = content.replace(/FABRIC/g, 'GREY_MATERIAL');
        
        // 3. Columns replacements
        content = content.replace(/greighWidth/g, 'piece');
        content = content.replace(/finishWidth/g, 'meter');
        content = content.replace(/greighRate/g, 'challanNumber');
        
        // Cleanup remaining TS errors
        content = content.replace(/case 'gsm':/g, "case 'piece':");
        content = content.replace(/aValue = a\.gsm \|\| 0;/g, "aValue = a.piece || 0;");
        content = content.replace(/bValue = b\.gsm \|\| 0;/g, "bValue = b.piece || 0;");

        content = content.replace(/case 'weight':/g, "case 'meter':");
        content = content.replace(/aValue = a\.weight \|\| 0;/g, "aValue = a.meter || 0;");
        content = content.replace(/bValue = b\.weight \|\| 0;/g, "bValue = b.meter || 0;");

        content = content.replace(/case 'greighRate':/g, "case 'challanNumber':");
        content = content.replace(/aValue = a\.greighRate \|\| 0;/g, "aValue = a.challanNumber || '';");
        content = content.replace(/bValue = b\.greighRate \|\| 0;/g, "bValue = b.challanNumber || '';");
        
        fs.writeFileSync(filePath, content);
      }
    }

    return NextResponse.json({ success: true, message: 'Fixed components' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message });
  }
}
