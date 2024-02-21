const cds = require('../../cds-plugin');
const fs = require('fs');

async function generateOpenAPI (filePath) {
    const openapiDocument = await cds.compile(`file:${filePath}`).to.openapi({ service: "ProcessorService" }); // to generate document for single service
    fs.writeFile('./services.openapi3.json', JSON.stringify(openapiDocument), err => {
        if (err) {
          console.error(err);
        } 
      });
}

generateOpenAPI('./srv/services.cds')
