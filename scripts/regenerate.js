// This script regenerates the OpenAPI snapshot files used in csdl2openapi.test.js.
// It automatically finds all test cases in the data directory and applies the correct options.

const fs = require('fs');
const path = require('path');
const lib = require('../lib/compile/csdl2openapi.js');

const dataDir = path.join(__dirname, '../test/lib/compile/data');

// Special options where required.
const specialOptions = {
    'TripPin': {
        host: 'services.odata.org',
        basePath: '/V4/(S(cnbm44wtbc1v5bgrlek5lpcc))/TripPinServiceRW',
        diagram: true
    }
};

// Default options for all other test cases.
const defaultOptions = { diagram: true };

console.log('Regenerating OpenAPI snapshots...');

fs.readdirSync(dataDir)
    // Filter for .json files that are not existing snapshots.
    .filter(file => file.endsWith('.json') && !file.endsWith('.openapi3.json'))
    .forEach(file => {
        const fileBaseName = path.basename(file, '.json');
        const inputFile = path.join(dataDir, file);
        const outputFile = path.join(dataDir, `${fileBaseName}.openapi3.json`);

        // Use special options if the file is in the whitelist, otherwise use defaults.
        const options = specialOptions[fileBaseName] || defaultOptions;

        try {
            console.log(`Processing ${file}...`);
            const csdl = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
            const openapi = lib.csdl2openapi(csdl, options);
            // Only write the file if it's a known test case (i.e., has an existing snapshot).
            if (fs.existsSync(outputFile)) {
                fs.writeFileSync(outputFile, JSON.stringify(openapi, null, 2) + '\n');
                console.log(`  -> Successfully generated ${path.basename(outputFile)}`);
            }
        } catch (error) {
            console.error(`  -> Error processing ${file}:`, error);
        }
    });

console.log('Finished regenerating snapshots.');
