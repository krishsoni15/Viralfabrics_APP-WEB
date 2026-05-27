/**
 * Script to replace console.log with logger
 * Run: node scripts/remove-console-logs.js
 */

const fs = require('fs');
const path = require('path');

const loggerImport = "import { logger } from '@/lib/logger';";
const logErrorImport = "import { logError } from '@/lib/logger';";

function shouldSkipFile(filePath) {
  // Skip node_modules, .next, and build files
  if (filePath.includes('node_modules') || 
      filePath.includes('.next') || 
      filePath.includes('dist') ||
      filePath.includes('.git')) {
    return true;
  }
  
  // Skip markdown and documentation files
  if (filePath.endsWith('.md') || 
      filePath.endsWith('.json') ||
      filePath.endsWith('.js') && !filePath.includes('app') && !filePath.includes('lib')) {
    return false; // Process JS files in app/lib
  }
  
  return false;
}

function processFile(filePath) {
  if (shouldSkipFile(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let hasLoggerImport = content.includes("from '@/lib/logger'");
  let hasLogErrorImport = content.includes('logError');
  
  // Replace console.log with logger.info (only in non-error contexts)
  content = content.replace(/console\.log\(/g, (match, offset) => {
    // Check if it's in a try-catch error handler
    const before = content.substring(Math.max(0, offset - 100), offset);
    if (before.includes('catch') || before.includes('error')) {
      return 'logger.error(';
    }
    return 'logger.info(';
  });
  
  // Replace console.error with logError
  if (content.includes('console.error(')) {
    content = content.replace(/console\.error\(/g, 'logError(');
    modified = true;
    if (!hasLogErrorImport) {
      // Add import at the top
      const importMatch = content.match(/^import .+ from ['"].+['"];?\n/m);
      if (importMatch) {
        const lastImportIndex = content.lastIndexOf(importMatch[0]);
        content = content.slice(0, lastImportIndex + importMatch[0].length) + 
                  logErrorImport + '\n' + 
                  content.slice(lastImportIndex + importMatch[0].length);
      } else {
        content = logErrorImport + '\n' + content;
      }
    }
  }
  
  // Replace console.warn with logger.warn
  content = content.replace(/console\.warn\(/g, 'logger.warn(');
  
  // Replace console.debug with logger.debug
  content = content.replace(/console\.debug\(/g, 'logger.debug(');
  
  // Add logger import if needed
  if ((content.includes('logger.') || content.includes('logError(')) && !hasLoggerImport) {
    const importMatch = content.match(/^import .+ from ['"].+['"];?\n/m);
    if (importMatch) {
      const lastImportIndex = content.lastIndexOf(importMatch[0]);
      content = content.slice(0, lastImportIndex + importMatch[0].length) + 
                loggerImport + '\n' + 
                content.slice(lastImportIndex + importMatch[0].length);
    } else {
      content = loggerImport + '\n' + content;
    }
    modified = true;
  }
  
  if (modified && (content.includes('logger.') || content.includes('logError('))) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
    return true;
  }
  
  return false;
}

// Process all TypeScript/JavaScript files
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || 
                (file.endsWith('.js') && (filePath.includes('app') || filePath.includes('lib')))) {
      processFile(filePath);
    }
  }
}

// Start processing
const rootDir = path.join(__dirname, '..');
console.log('Processing files...');
processDirectory(path.join(rootDir, 'app'));
processDirectory(path.join(rootDir, 'lib'));
console.log('Done!');

