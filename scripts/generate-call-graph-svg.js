const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// --- Configuration ---
const projectRoot = path.join(__dirname, '..');
const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
const svgOutputPath = path.join(projectRoot, 'call-graph.svg');
const analysisRoot = path.join(projectRoot, 'lib');


// --- Main Orchestration ---
async function main() {
  try {
    console.log('Starting call graph generation...');
    const files = getProjectSourceFiles(analysisRoot, '.js');
    const callGraph = analyzeProject(files, tsconfigPath, projectRoot);
    const mermaidDiagram = convertCallGraphToMermaid(callGraph, analysisRoot);
    await generateSvgFromMermaid(mermaidDiagram, svgOutputPath);
    console.log(`SVG diagram saved to ${svgOutputPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to generate call graph:', message);
    process.exit(1);
  }
}

// --- File System Operations ---
function getProjectSourceFiles(rootDir, extension) {
    return fs.readdirSync(rootDir, { recursive: true })
        .filter(file => file.toString().endsWith(extension))
        .map(file => path.join(rootDir, file.toString()));
}


// --- TypeScript Analysis ---
function analyzeProject(entryFiles, tsconfigPath, projectRoot) {
    const compilerOptions = readCompilerOptions(tsconfigPath, projectRoot);
    const program = ts.createProgram(entryFiles, compilerOptions);
    return generateCallGraph(program);
}

function readCompilerOptions(configPath, rootDir) {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(`Error reading tsconfig.json: ${configFile.error.messageText}`);
  }

  const parsedCommandLine = ts.parseJsonConfigFileContent(configFile.config, ts.sys, rootDir);
  if (parsedCommandLine.errors.length > 0) {
    const messages = parsedCommandLine.errors.map(e => e.messageText).join('\n');
    throw new Error(`Error parsing tsconfig.json:\n${messages}`);
  }
  return { ...parsedCommandLine.options, allowJs: true, checkJs: true };
}

function generateCallGraph(program) {
  const checker = program.getTypeChecker();
  const callGraph = new Map();

  function visit(node, sourceFile) {
    if (ts.isCallExpression(node)) {
      const calleeSignature = checker.getResolvedSignature(node);
      if (!calleeSignature) return;

      const calleeDeclaration = calleeSignature.getDeclaration();
      if (!calleeDeclaration) return;

      const calleeSourceFile = calleeDeclaration.getSourceFile().fileName;
      const calleeName = getFunctionName(calleeDeclaration, checker);

      const callerDeclaration = findContainingFunction(node);
      if (callerDeclaration) {
        const callerSourceFile = sourceFile.fileName;
        const callerName = getFunctionName(callerDeclaration, checker);

        if (!callGraph.has(callerSourceFile)) {
          callGraph.set(callerSourceFile, []);
        }
        callGraph.get(callerSourceFile).push({
          caller: callerName,
          callee: calleeName,
          calleeFile: calleeSourceFile,
        });
      }
    }
    ts.forEachChild(node, (child) => visit(child, sourceFile));
  }

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile) {
        visit(sourceFile, sourceFile);
    }
  }

  return Object.fromEntries(callGraph.entries());
}

function findContainingFunction(node) {
    let current = node.parent;
    while (current) {
        if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current) || ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
            return current;
        }
        current = current.parent;
    }
    return undefined;
}

function getFunctionName(declaration, checker) {
    const symbol = declaration.name ? checker.getSymbolAtLocation(declaration.name) : undefined;
    if (symbol) {
        return symbol.getName();
    }
    
    if (declaration.name && ts.isIdentifier(declaration.name)) {
        return declaration.name.text;
    }

    if ((ts.isFunctionExpression(declaration) || ts.isArrowFunction(declaration)) &&
        ts.isVariableDeclaration(declaration.parent) &&
        declaration.parent.name && ts.isIdentifier(declaration.parent.name)) {
        return declaration.parent.name.text;
    }

    return 'anonymous';
}


// --- Diagram Generation ---
function convertCallGraphToMermaid(callGraph, filterPrefix) {
  let mermaidString = 'graph TD\n';
  const nodes = new Set();
  
  const createNodeId = (fileName, functionName) => {
    const safeFileName = path.basename(fileName).replace(/[.-]/g, '_');
    const safeFunctionName = functionName.replace(/[^a-zA-Z0-9_]/g, '_');
    return `${safeFileName}__${safeFunctionName}`;
  };

  for (const callerFile in callGraph) {
    if (!callerFile.startsWith(filterPrefix)) continue;

    for (const call of callGraph[callerFile]) {
      if (!call.calleeFile || !call.calleeFile.startsWith(filterPrefix)) continue;

      const callerId = createNodeId(callerFile, call.caller);
      const calleeId = createNodeId(call.calleeFile, call.callee);

      if (!nodes.has(callerId)) {
        mermaidString += `  ${callerId}["${call.caller}"]\n`;
        nodes.add(callerId);
      }
      if (!nodes.has(calleeId)) {
        mermaidString += `  ${calleeId}["${call.callee}"]\n`;
        nodes.add(calleeId);
      }
      
      const link = `  ${callerId} --> ${calleeId}\n`;
      if (!mermaidString.includes(link)) {
        mermaidString += link;
      }
    }
  }

  return mermaidString;
}


// --- SVG Generation ---
function generateSvgFromMermaid(mermaidDiagram, outputPath) {
  return new Promise((resolve, reject) => {
    const command = `npx mmdc -o ${outputPath}`;
    const child = exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`Error executing mmdc: ${error.message}\n${stderr}`));
      }
      if (stderr) {
        console.warn(`mmdc warnings:\n${stderr}`);
      }
      resolve(stdout);
    });
    
    if (child.stdin) {
      child.stdin.write(mermaidDiagram);
      child.stdin.end();
    }
  });
}

// --- Script Entry Point ---
main();
