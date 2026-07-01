#!/usr/bin/env node
/**
 * fix-native-compat.js
 * ---------------------
 * Patches Expo SDK 52 native modules so they compile against expo-modules-core v56.
 *
 * Fixes:
 *  1. expo-file-system  — missing AppDirectoriesModuleInterface & FilePermissionModuleInterface
 *  2. expo-image-picker — missing ModuleNotFoundException & imageLoader property
 *  3. expo-media-library — Promise.reject signature mismatch (String vs String?)
 *  4. expo-camera        — missing barcodescanner & facedetector interfaces
 */

const fs = require('fs');
const path = require('path');

const NM = path.join(__dirname, 'node_modules');
const ok  = (msg) => console.log(`  \x1b[32m[✓]\x1b[0m ${msg}`);
const skip = (msg) => console.log(`  \x1b[33m[–]\x1b[0m ${msg}`);
const info = (msg) => console.log(`  \x1b[36m[i]\x1b[0m ${msg}`);

console.log('\n\x1b[1m━━━ Patching native module compatibility ━━━\x1b[0m\n');

// ─── Helper: write file only if it doesn't already exist (or force) ───
function ensureFile(filePath, content, description) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing.includes('// COMPAT-STUB')) {
      skip(`${description} (already patched)`);
      return;
    }
  }
  fs.writeFileSync(filePath, content);
  ok(description);
}

// ─── Helper: patch a source file in-place ───
function patchFile(filePath, replacements, description) {
  if (!fs.existsSync(filePath)) {
    skip(`${description} — file not found: ${filePath}`);
    return false;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.replace(search, replace);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content);
    ok(description);
  } else {
    skip(`${description} (already applied or no match)`);
  }
  return changed;
}

// ═══════════════════════════════════════════════════════════
// 1. Create stub: AppDirectoriesModuleInterface
// ═══════════════════════════════════════════════════════════
ensureFile(
  path.join(NM, 'expo-modules-core/android/src/main/java/expo/modules/interfaces/filesystem/AppDirectoriesModuleInterface.kt'),
  `// COMPAT-STUB — provides the interface removed in expo-modules-core v56
package expo.modules.interfaces.filesystem

import java.io.File

interface AppDirectoriesModuleInterface {
  val cacheDirectory: File
  val persistentFilesDirectory: File
}
`,
  'Created AppDirectoriesModuleInterface stub'
);

// ═══════════════════════════════════════════════════════════
// 2. Create stub: FilePermissionModuleInterface
// ═══════════════════════════════════════════════════════════
ensureFile(
  path.join(NM, 'expo-modules-core/android/src/main/java/expo/modules/interfaces/filesystem/FilePermissionModuleInterface.kt'),
  `// COMPAT-STUB — provides the interface removed in expo-modules-core v56
package expo.modules.interfaces.filesystem

import java.util.EnumSet

enum class FilePermissionModuleInterfacePermission {
  READ, WRITE
}

interface FilePermissionModuleInterface {
  fun getPathPermissions(context: android.content.Context, path: String): EnumSet<FilePermissionModuleInterfacePermission>
}
`,
  'Created FilePermissionModuleInterface stub'
);

// ═══════════════════════════════════════════════════════════
// 3. Create stub: ModuleNotFoundException
// ═══════════════════════════════════════════════════════════
ensureFile(
  path.join(NM, 'expo-modules-core/android/src/main/java/expo/modules/core/errors/ModuleNotFoundException.kt'),
  `// COMPAT-STUB — provides the exception removed in expo-modules-core v56
package expo.modules.core.errors

class ModuleNotFoundException(moduleName: String) :
  expo.modules.kotlin.exception.CodedException("Module '$moduleName' not found. Are you sure all modules are linked correctly?")
`,
  'Created ModuleNotFoundException stub'
);

// ═══════════════════════════════════════════════════════════
// 4. Create stub: barcodescanner interfaces (for expo-camera)
// ═══════════════════════════════════════════════════════════
const barcodeDir = path.join(NM, 'expo-modules-core/android/src/main/java/expo/modules/interfaces/barcodescanner');

ensureFile(
  path.join(barcodeDir, 'BarCodeScannerInterface.kt'),
  `// COMPAT-STUB
package expo.modules.interfaces.barcodescanner

interface BarCodeScannerInterface {
  fun setSettings(settings: BarCodeScannerSettings)
  fun scanMultiple(imageData: ByteArray, width: Int, height: Int, rotation: Int): List<BarCodeScannerResult>
  fun scan(imageData: ByteArray, width: Int, height: Int, rotation: Int): BarCodeScannerResult?
  fun isAvailable(): Boolean
}
`,
  'Created BarCodeScannerInterface stub'
);

ensureFile(
  path.join(barcodeDir, 'BarCodeScannerResult.kt'),
  `// COMPAT-STUB
package expo.modules.interfaces.barcodescanner

open class BarCodeScannerResult(
  val type: Int = 0,
  val value: String = "",
  val cornerPoints: List<Int>? = null
)
`,
  'Created BarCodeScannerResult stub'
);

ensureFile(
  path.join(barcodeDir, 'BarCodeScannerSettings.kt'),
  `// COMPAT-STUB
package expo.modules.interfaces.barcodescanner

class BarCodeScannerSettings(val types: List<Int> = emptyList())
`,
  'Created BarCodeScannerSettings stub'
);

ensureFile(
  path.join(barcodeDir, 'BarCodeScannerProviderInterface.kt'),
  `// COMPAT-STUB
package expo.modules.interfaces.barcodescanner

interface BarCodeScannerProviderInterface {
  fun createBarCodeDetectorWithContext(context: android.content.Context): BarCodeScannerInterface
}
`,
  'Created BarCodeScannerProviderInterface stub'
);

// ═══════════════════════════════════════════════════════════
// 5. Create stub: facedetector interfaces (for expo-camera)
// ═══════════════════════════════════════════════════════════
const faceDir = path.join(NM, 'expo-modules-core/android/src/main/java/expo/modules/interfaces/facedetector');

ensureFile(
  path.join(faceDir, 'FaceDetectorInterface.kt'),
  `// COMPAT-STUB
package expo.modules.interfaces.facedetector

import android.os.Bundle

interface FaceDetectorInterface {
  fun setSettings(settings: Map<String, Any>)
  fun detectFaces(imageData: ByteArray, width: Int, height: Int, rotation: Int, mirrored: Boolean, scaleX: Double, scaleY: Double, callback: FaceDetectionCallback)
}

interface FaceDetectionCallback {
  fun onCompleted(results: List<Bundle>)
  fun onError(error: Throwable)
}

interface FaceDetectorProviderInterface {
  fun createFaceDetectorWithContext(context: android.content.Context): FaceDetectorInterface
}
`,
  'Created FaceDetectorInterface stub'
);

// ═══════════════════════════════════════════════════════════
// 6. Patch expo-file-system — FileSystemModule.kt String? issue
// ═══════════════════════════════════════════════════════════
const fileSystemModulePath = path.join(NM, 'expo-file-system/android/src/main/java/expo/modules/filesystem/FileSystemModule.kt');
if (fs.existsSync(fileSystemModulePath)) {
  let content = fs.readFileSync(fileSystemModulePath, 'utf8');
  // Fix line 754: Argument type mismatch: actual type is 'String?', but 'String' was expected.
  // This is a Kotlin null-safety issue — we need to add a !! or ?: "" to any String? being passed as String
  // The exact fix depends on the line, but we can do a broad approach
  let changed = false;

  // Fix Context? to Context 
  const fsPathKt = path.join(NM, 'expo-file-system/android/src/main/java/expo/modules/filesystem/next/FileSystemPath.kt');
  if (fs.existsSync(fsPathKt)) {
    let pathContent = fs.readFileSync(fsPathKt, 'utf8');
    if (pathContent.includes('appContext.reactContext') && !pathContent.includes('// COMPAT-PATCHED')) {
      // Add non-null assertion to reactContext access
      pathContent = pathContent.replace(
        /appContext\.reactContext(?!!)/g,
        'appContext.reactContext!!'
      );
      pathContent = '// COMPAT-PATCHED\n' + pathContent;
      fs.writeFileSync(fsPathKt, pathContent);
      ok('Patched FileSystemPath.kt — reactContext null-safety');
      changed = true;
    }
  }

  if (!changed) {
    skip('expo-file-system FileSystemPath.kt (already patched or no match)');
  }
}

// ═══════════════════════════════════════════════════════════
// 7. Patch expo-media-library — reject signature mismatch
// ═══════════════════════════════════════════════════════════
patchFile(
  path.join(NM, 'expo-media-library/android/src/main/java/expo/modules/medialibrary/MediaLibraryPermissionPromiseWrapper.kt'),
  [
    // Change the non-nullable 'code: String' to nullable 'code: String?'
    ['override fun reject(code: String, message: String?, cause: Throwable?)',
     'override fun reject(code: String?, message: String?, cause: Throwable?)']
  ],
  'Patched MediaLibraryPermissionPromiseWrapper.kt — reject signature'
);

// ═══════════════════════════════════════════════════════════
// 8. Patch expo-image-picker — imageLoader via legacyModule
// ═══════════════════════════════════════════════════════════
const compressionExporterPath = path.join(NM, 'expo-image-picker/android/src/main/java/expo/modules/imagepicker/exporters/CompressionImageExporter.kt');
if (fs.existsSync(compressionExporterPath)) {
  let content = fs.readFileSync(compressionExporterPath, 'utf8');
  if (content.includes('appContextProvider.appContext.imageLoader') && !content.includes('// COMPAT-PATCHED')) {
    // Replace imageLoader property access with legacyModule call
    content = content.replace(
      'appContextProvider.appContext.imageLoader',
      'appContextProvider.appContext.legacyModule<expo.modules.interfaces.imageloader.ImageLoaderInterface>()'
    );
    content = '// COMPAT-PATCHED\n' + content;
    fs.writeFileSync(compressionExporterPath, content);
    ok('Patched CompressionImageExporter.kt — imageLoader → legacyModule');
  } else {
    skip('CompressionImageExporter.kt (already patched)');
  }
}

// ═══════════════════════════════════════════════════════════
// 9. Fix expo-file-system FileSystemModule.kt String? mismatch
// ═══════════════════════════════════════════════════════════
if (fs.existsSync(fileSystemModulePath)) {
  let content = fs.readFileSync(fileSystemModulePath, 'utf8');
  if (!content.includes('// COMPAT-PATCHED-STRING')) {
    // The issue is around line 754 where a nullable String? is passed where String is expected
    // Find patterns like .path which returns String? and add orEmpty() or !!
    // Most common pattern: uri.path being passed as non-null
    let changed = false;
    
    // Fix any uri.path that needs to be non-null
    if (content.includes('.path,') || content.includes('.path)')) {
      // This is a broad fix — make uri.path safe
      content = content.replace(/\.path(?=[,)])/g, '.path.orEmpty()');
      changed = true;
    }
    
    if (changed) {
      content = '// COMPAT-PATCHED-STRING\n' + content;
      fs.writeFileSync(fileSystemModulePath, content);
      ok('Patched FileSystemModule.kt — String? null-safety');
    } else {
      skip('FileSystemModule.kt String? patch (no matching patterns)');
    }
  } else {
    skip('FileSystemModule.kt (already patched)');
  }
}

// ═══════════════════════════════════════════════════════════
// 10. Fix expo-camera legacy tasks — ensure correct imports
// ═══════════════════════════════════════════════════════════
const cameraLegacyDir = path.join(NM, 'expo-camera/android/src/main/java/expo/modules/camera/legacy');

// Check and fix FaceDetectorTask.kt
const faceDetectorTaskPath = path.join(cameraLegacyDir, 'tasks/FaceDetectorTask.kt');
if (fs.existsSync(faceDetectorTaskPath)) {
  let content = fs.readFileSync(faceDetectorTaskPath, 'utf8');
  if (!content.includes('// COMPAT-PATCHED')) {
    // Fix the import path
    content = content.replace(
      'import expo.modules.facedetector.',
      'import expo.modules.interfaces.facedetector.'
    );
    content = '// COMPAT-PATCHED\n' + content;
    fs.writeFileSync(faceDetectorTaskPath, content);
    ok('Patched FaceDetectorTask.kt imports');
  }
}

// Fix FaceDetectorAsyncTaskDelegate.kt
const fdDelegatePath = path.join(cameraLegacyDir, 'tasks/FaceDetectorAsyncTaskDelegate.kt');
if (fs.existsSync(fdDelegatePath)) {
  let content = fs.readFileSync(fdDelegatePath, 'utf8');
  if (!content.includes('// COMPAT-PATCHED')) {
    content = content.replace(
      'import expo.modules.facedetector.',
      'import expo.modules.interfaces.facedetector.'
    );
    content = '// COMPAT-PATCHED\n' + content;
    fs.writeFileSync(fdDelegatePath, content);
    ok('Patched FaceDetectorAsyncTaskDelegate.kt imports');
  }
}

console.log('\n\x1b[1m━━━ Native compatibility patching complete ━━━\x1b[0m\n');
