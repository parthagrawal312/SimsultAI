const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

console.log('Starting code obfuscation...');

// Define paths
const sourceDir = __dirname;
const outputDir = path.join(__dirname, 'dist', 'app');
const filesToObfuscate = ['main.js', 'renderer.js'];

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

filesToObfuscate.forEach(fileName => {
    const filePath = path.join(sourceDir, fileName);
    const outputPath = path.join(outputDir, fileName);

    console.log(`Reading ${fileName}...`);
    const sourceCode = fs.readFileSync(filePath, 'utf8');

    console.log(`Obfuscating ${fileName}...`);
    const obfuscationResult = JavaScriptObfuscator.obfuscate(sourceCode, {
        compact: true,
        controlFlowFlattening: true, // This makes the code structure confusing
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true, // Adds random useless code
        deadCodeInjectionThreshold: 0.4,
        debugProtection: false,
        disableConsoleOutput: true, // Prevents use of console.log, etc.
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: false,
        selfDefending: true, // Makes the code resistant to formatting/beautifying
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 10,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayEncoding: ['base64'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 2,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 4,
        stringArrayWrappersType: 'function',
        transformObjectKeys: true,
        unicodeEscapeSequence: false
    });

    console.log(`Writing obfuscated ${fileName} to ${outputPath}`);
    fs.writeFileSync(outputPath, obfuscationResult.getObfuscatedCode());
});

console.log('Obfuscation complete! ✨');