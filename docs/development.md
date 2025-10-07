# OpenAPI Development

## Architecture

The conversion from a CDS model (CSN) to an OpenAPI specification is orchestrated by `lib/compile/index.js`.

1.  **CSN to CSDL:** The CSN model is compiled to a CSDL JSON document using `@sap/cds`. CSDL (Common Schema Definition Language) defines the service's Entity Data Model (EDM). The XML serialization of this is typically found within an EDMX wrapper.
2.  **CSDL to OpenAPI:** The CSDL is then transformed into an OpenAPI 3.0 specification by `lib/compile/csdl2openapi.js`.
3.  The final output is the OpenAPI specification as a JSON object.

## OData Vocabularies

The conversion process relies on OData annotations, which are present in the CSN and then translated into the CSDL. These annotations are defined in standard vocabularies, which you can find in the official documentation:

[OASIS OData Vocabularies](https://oasis-tcs.github.io/odata-vocabularies/vocabularies/)

