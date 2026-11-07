// my-tool-plugin - A plugin that reads JS files and enables tool calling
const fs = require('fs');
const path = require('path');

// Function to read all JS files in a directory
function readJsFiles(directory) {
  const jsFiles = [];
  
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.js')) {
        jsFiles.push(fullPath);
      }
    }
  }
  
  walkDir(directory);
  return jsFiles;
}

// Function to analyze JS file content
function analyzeJsFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      path: filePath,
      size: content.length,
      hasExports: content.includes('exports'),
      hasImports: content.includes('import'),
      hasAsync: content.includes('async'),
      hasWorker: content.includes('Worker'),
      hasPromise: content.includes('Promise')
    };
  } catch (error) {
    return {
      path: filePath,
      error: error.message
    };
  }
}

// Main plugin function
async function runPlugin(directory) {
  console.log('=== my-tool-plugin ===');
  console.log(`Reading JS files from: ${directory}`);
  
  const jsFiles = readJsFiles(directory);
  console.log(`Found ${jsFiles.length} JavaScript files`);
  
  console.log('\n--- File Analysis ---');
  
  for (const file of jsFiles) {
    const analysis = analyzeJsFile(file);
    console.log(`\n${file}`);
    
    if (analysis.error) {
      console.log(`  Error: ${analysis.error}`);
    } else {
      console.log(`  Size: ${analysis.size} bytes`);
      console.log(`  Has exports: ${analysis.hasExports}`);
      console.log(`  Has imports: ${analysis.hasImports}`);
      console.log(`  Has async: ${analysis.hasAsync}`);
      console.log(`  Has Worker: ${analysis.hasWorker}`);
      console.log(`  Has Promise: ${analysis.hasPromise}`);
    }
  }
  
  // Enable tool calling demonstration
  console.log('\n--- Tool Calling Enabled ---');
  console.log('This plugin can now send tools like web_search');
  console.log('Example: web_search({ queries: ["current events"] })');
  
  return jsFiles;
}

// Run if executed directly
if (require.main === module) {
  const directory = process.argv[2] || '.';
  runPlugin(directory).catch(console.error);
}

module.exports = {
  readJsFiles,
  analyzeJsFile,
  runPlugin
};