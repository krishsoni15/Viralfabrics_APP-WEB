import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const srcDir = path.join(process.cwd(), 'app/api/fabrics');
    const destDir = path.join(process.cwd(), 'app/api/grey-materials');

    function copyDir(src: string, dest: string) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
          try {
            if (entry.name.endsWith('.ts')) {
              let content = fs.readFileSync(destPath, 'utf8');
              content = content.replace(/fabric/g, 'greyMaterial');
              content = content.replace(/Fabric/g, 'GreyMaterial');
              content = content.replace(/FABRIC/g, 'GREY_MATERIAL');
              // Ensure path imports are correct
              content = content.replace(/@\/models\/GreyMaterial/g, '@/models/GreyMaterial');
              fs.writeFileSync(destPath, content);
            }
          } catch (e) {}
        }
      }
    }

    copyDir(srcDir, destDir);
    return NextResponse.json({ success: true, message: 'Copied API successfully NEW' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message });
  }
}
