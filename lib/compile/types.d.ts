type StringSchema = {
    type: 'string'
    format?: 'base64url' | 'uuid' | 'time' | 'date' | 'date-time' | 'duration'
    maxLength?: number
    example?: string
    pattern?: string
}

type NumberSchema = {
    type: 'number' | 'integer'
    format?: 'float' | 'double' | 'decimal' | 'uint8' | 'int8' | 'int16' | 'int32' | 'int64'
    multipleOf?: number
    example?: number,
    minimum?: number
    maximum?: number
    exclusiveMinimum?: boolean
    exclusiveMaximum?: boolean
}

type BooleanSchema = {
    type: 'boolean'
}

type ArraySchema = {
    type: 'array',
    items: Schema
}

type ObjectSchema = {
    type: 'object',
    properties: { value: any } & {},
}

// for responses that only contain meta information
type EmptySchema = {}

type Meta = {
    nullable?: boolean
    default?: unknown
    example?: string | number,
    description?: string
    '$ref'?: unknown
}

type SingleSchema = (StringSchema | NumberSchema | BooleanSchema | ArraySchema | ObjectSchema | EmptySchema) & Meta

type AnyOf = { anyOf: Schema[] } & Meta
type AllOf = { allOf: Schema[] } & Meta
type MultiSchema = AnyOf | AllOf

export type Schema = (SingleSchema | MultiSchema)


export type TargetRestrictions = {
    Countable?: boolean
    Expandable?: boolean
}

// despite how CSDL is defined in the standard,
// we assume to be working with its .properties field
// throughout our conversion
import type { CSDL as CSDL_ } from './csdl-types';
export type CSDL = CSDL_['properties'];



export type PathItem = {
    get?: Request,
    post?: Request,
    put?: Request,
    patch?: Request,
    delete?: Request,
} | Request

type MIMEType = 'multipart/mixed' | 'application/json'

export type Parameter = {
    name?: string,
    in?: 'path' | 'query' | 'header',
    description?: string,
    required?: boolean,
    schema?: Schema,
    example?: string | number,
    explode?: boolean
}

type Request = {
    summary?: string,
    description?: string,
    tags?: string[],
    parameters?: Parameter[],
    responses?: Record<string, Response>,
    requestBody?: RequestBody,
}

type Response = {
    required?: boolean,
    description?: string,
    content?: {[mime in MIMEType]?: {
        schema?: SingleSchema & { title?: string },
        example?: string
    }},
    responses?: Record<string, { $ref: string }>,
    $ref?: string
}

type RequestBody = {
    required: boolean,
    description: string,
    content: Record<string, {
        schema: { type: string },
        example: string
    }>,
}

export type Paths = { [path: string]: PathItem }
