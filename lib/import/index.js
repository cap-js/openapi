"use strict"

const { importOpenAPI } = require("./importOpenAPI");

const INVALID_OPENAPI_FILE = 'The OpenAPI file is not valid. Specify the correct OpenAPI file.';

function openAPI2csn(source) {
    let csn = {};
    try {
        const fileContentToJSON = JSON.parse(source);
        csn = importOpenAPI(fileContentToJSON);
    } catch {
        throw new Error(INVALID_OPENAPI_FILE);
    }
    return csn;
}

module.exports = {
    openAPI2csn
}
