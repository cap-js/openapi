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

type SingleSchema = StringSchema | NumberSchema | BooleanSchema | ArraySchema

type AnyOf = { anyOf: Schema[] }
type AllOf = { allOf: Schema[] }
type MultiSchema = AnyOf | AllOf

export type Schema = (SingleSchema | MultiSchema) & {
    nullable?: boolean
    default?: unknown
    example?: string | number,
    description?: string
    '$ref'?: unknown
}