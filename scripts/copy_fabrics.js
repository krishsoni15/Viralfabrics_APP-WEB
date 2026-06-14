const fs = require('fs');
const path = require('path');

const srcDir = '/home/krish/Downloads/ViralFabrics-main/app/(pages)/(dashboard)/fabrics';
const destDir = '/home/krish/Downloads/ViralFabrics-main/app/(pages)/(dashboard)/grey-materials';

function copyDir(src, dest) {
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
        let content = fs.readFileSync(destPath, 'utf8');
        content = content.replace(/fabric/g, 'greyMaterial');
        content = content.replace(/Fabric/g, 'GreyMaterial');
        content = content.replace(/FABRIC/g, 'GREY_MATERIAL');
        content = content.replace(/fabrics/g, 'grey-materials');
        content = content.replace(/Fabrics/g, 'GreyMaterials');
        content = content.replace(/FABRICS/g, 'GREY_MATERIALS');
        fs.writeFileSync(destPath, content);
      } catch (e) {
        // Might fail for binary files like images if any exist, ignore
      }
    }
  }
}

try {
  copyDir(srcDir, destDir);
  console.log('Copy successful');
  fs.writeFileSync('/home/krish/Downloads/ViralFabrics-main/copy_success.txt', 'Copy successful');
} catch (error) {
  console.error('Copy failed:', error);
  fs.writeFileSync('/home/krish/Downloads/ViralFabrics-main/copy_error.txt', error.toString());
}
