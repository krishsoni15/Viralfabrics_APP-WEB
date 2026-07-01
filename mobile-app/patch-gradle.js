const fs = require('fs');
const path = require('path');

const TARGET_VERSION = '1.0.0';
const file = path.join(__dirname, 'node_modules/@react-native/gradle-plugin/settings.gradle.kts');

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');

  // Match any foojay-resolver-convention line (with any version, or our previous "removed" comment)
  const foojayRegex = /^.*foojay-resolver-convention.*$/gm;
  const match = content.match(foojayRegex);

  if (match && match[0].includes(`version("${TARGET_VERSION}")`)) {
    console.log(`[✓] foojay-resolver-convention already at ${TARGET_VERSION}.`);
  } else if (match) {
    content = content.replace(foojayRegex, `plugins { id("org.gradle.toolchains.foojay-resolver-convention").version("${TARGET_VERSION}") }`);
    fs.writeFileSync(file, content);
    console.log(`[✓] Patched foojay-resolver-convention → ${TARGET_VERSION} (fixes IBM_SEMERU on Gradle 9+).`);
  } else {
    // Line was completely removed or doesn't exist — add it back
    content = content.replace(
      /^(pluginManagement\s*\{[\s\S]*?\n\})/m,
      `$1\n\nplugins { id("org.gradle.toolchains.foojay-resolver-convention").version("${TARGET_VERSION}") }`
    );
    fs.writeFileSync(file, content);
    console.log(`[✓] Added foojay-resolver-convention ${TARGET_VERSION} (required for JDK auto-provisioning).`);
  }
} else {
  console.log('[!] settings.gradle.kts not found — skipping patch.');
}
