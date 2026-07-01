const ts = require('typescript');
const path = require('path');

function runCheck() {
  const configPath = ts.findConfigFile(
    __dirname,
    ts.sys.fileExists,
    'tsconfig.json'
  );
  if (!configPath) {
    console.error("Could not find tsconfig.json");
    process.exit(1);
  }

  const parseConfigHost = {
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    readDirectory: ts.sys.readDirectory,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      console.error(ts.formatDiagnostics([diagnostic], formatHost));
    }
  };

  const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    parseConfigHost
  );

  if (!parsedCommandLine) {
    console.error("Failed to parse config file");
    process.exit(1);
  }

  const formatHost = {
    getCanonicalFileName: path => path,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine
  };

  const program = ts.createProgram(parsedCommandLine.fileNames, parsedCommandLine.options);
  const emitResult = program.emit(undefined, () => {}, undefined, true); // true for noEmit

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  console.log(`Found ${allDiagnostics.length} diagnostics:`);
  allDiagnostics.forEach(diagnostic => {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    }
  });
}

runCheck();
