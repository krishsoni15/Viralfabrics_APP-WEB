const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '../public/sw.js');

try {
  let content = fs.readFileSync(swPath, 'utf8');
  const newVersion = 'v' + Date.now();
  
  // Try matching dynamic version first
  if (content.includes("const BUILD_VERSION = 'v' + Date.now();")) {
    content = content.replace("const BUILD_VERSION = 'v' + Date.now();", `const BUILD_VERSION = '${newVersion}';`);
  } else {
    // Match static version format 'v1781782255720'
    content = content.replace(/const BUILD_VERSION = 'v[^']*';/, `const BUILD_VERSION = '${newVersion}';`);
  }
  
  fs.writeFileSync(swPath, content, 'utf8');
  console.log(`✅ Updated Service Worker BUILD_VERSION to ${newVersion}`);
} catch (error) {
  console.error('❌ Failed to update Service Worker BUILD_VERSION:', error);
}
