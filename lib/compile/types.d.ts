export type StringSchema = {
    type: 'string'
    format?: 'base64url' | 'uuid' | 'time' | 'date' | 'date-time' | 'duration'
    maxLength?: number
    example?: string
    pattern?: string
}

export type NumberSchema = {
    type: 'number' | 'integer'
    format?: 'float' | 'double' | 'decimal' | 'uint8' | 'int8' | 'int16' | 'int32' | 'int64'
    multipleOf?: number
    example?: number,
    minimum?: number
    maximum?: number
    exclusiveMinimum?: boolean
    exclusiveMaximum?: boolean
}

export type BooleanSchema = {
    type: 'boolean'
}

export type ArraySchema = {
    type: 'array',
    items: Schema
}

type Meta = {
    nullable?: boolean
    default?: unknown
    example?: string | number,
    description?: string
    '$ref'?: unknown
}

type SingleSchema = (StringSchema | NumberSchema | BooleanSchema | ArraySchema) & Meta

export type AnyOf = { anyOf: Schema[] } & Meta
export type AllOf = { allOf: Schema[] } & Meta
type MultiSchema = AnyOf | AllOf

export type Schema = (SingleSchema | MultiSchema)

export type TargetRestrictions = {
    Countable?: boolean
    Expandable?: boolean
}

// in spite of how CSDL is define in the standard,
// we assume to be working with its .properties field
// throughout our conversion
import type { CSDL as CSDL_ } from './csdl';
export type CSDL = CSDL_['properties'];
