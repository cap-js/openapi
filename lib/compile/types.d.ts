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

type Meta = {
    nullable?: boolean
    default?: unknown
    example?: string | number,
    description?: string
    '$ref'?: unknown
}

type SingleSchema = (StringSchema | NumberSchema | BooleanSchema | ArraySchema) & Meta

type AnyOf = { anyOf: Schema[] } & Meta
type AllOf = { allOf: Schema[] } & Meta
type MultiSchema = AnyOf | AllOf

export type Schema = (SingleSchema | MultiSchema)