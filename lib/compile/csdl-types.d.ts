// generated using https://app.quicktype.io/
// and https://raw.githubusercontent.com/oasis-tcs/odata-csdl-schemas/refs/heads/main/schemas/csdl.schema.json
// modifcations:
// - CSDLProperties.$Version changed to string, as that is how we use it
// - CSDLProperties.$EntityContrainer changed to string
// - replace generated and unclear type names with descriptive ones

export type CSDL = {
    readonly $schema:              string;
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    CSDLPatternProperties;
    readonly propertyNames:        PropertyNames;
    readonly properties:           CSDLProperties;
    readonly required:             string[];
    readonly definitions:          Definitions;
}

export type Definitions = {
    readonly Schema:                    Schema;
    readonly EntityType:                EntityType;
    readonly ComplexType:               ComplexType;
    readonly Property:                  Property;
    readonly NavigationProperty:        NavigationProperty;
    readonly EnumType:                  EnumType;
    readonly TypeDefinition:            TypeDefinition;
    readonly Term:                      Term;
    readonly Action:                    ActionOrFunction;
    readonly Function:                  ActionOrFunction;
    readonly EntityContainer:           EntityContainer;
    readonly EntitySet:                 EntitySet;
    readonly Singleton:                 Singleton;
    readonly ActionImport:              ActionImport;
    readonly FunctionImport:            FunctionImport;
    readonly NavigationPropertyBinding: NavigationPropertyBinding;
    readonly Parameter:                 Parameter;
    readonly ReturnType:                ReturnType;
    readonly MaxLength:                 MaxLength;
    readonly Unicode:                   Unicode;
    readonly Precision:                 MaxLength;
    readonly Scale:                     Scale;
    readonly SimpleIdentifier:          QualifiedName;
    readonly QualifiedName:             QualifiedName;
    readonly SRID:                      Srid;
    readonly Annotation:                Annotation;
}

export type ActionOrFunction = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ActionPatternProperties;
    readonly properties:           ActionProperties;
    readonly required:             string[];
}

export type ActionPatternProperties = {
    readonly "^@": ReferenceObject;
}

export type ReferenceObject = {
    readonly $ref: string;
}

export type ActionProperties = {
    readonly $Kind:          Version;
    readonly $IsBound:       Unicode;
    readonly $EntitySetPath: Srid;
    readonly $Parameter:     ReferenceObject;
    readonly $ReturnType:    ReferenceObject;
    readonly $IsComposable?: Unicode;
}

export type Srid = {
    readonly description: string;
    readonly type:        SRIDType;
}

export enum SRIDType {
    Integer = "integer",
    String = "string",
}

export type Unicode = {
    readonly description: string;
    readonly type:        UnicodeType;
    readonly default:     boolean;
    readonly examples:    boolean[];
}

export enum UnicodeType {
    Boolean = "boolean",
}

export type Version = {
    readonly description: string;
    readonly enum:        string[];
}

export type ActionImport = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ActionPatternProperties;
    readonly properties:           ActionImportProperties;
    readonly required:             string[];
}

export type ActionImportProperties = {
    readonly $Action:    Srid;
    readonly $EntitySet: Srid;
}

export type Annotation = {
    readonly description: string;
}

export type ComplexType = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ComplexTypePatternProperties;
    readonly properties:           ComplexTypeProperties;
    readonly required:             string[];
}

export type ComplexTypePatternProperties = {
    readonly "^@":                                                                                    ReferenceObject;
    readonly "^(_|\\p{L}|\\p{Nl})(_|\\p{L}|\\p{Nl}|\\p{Nd}|\\p{Mn}|\\p{Mc}|\\p{Pc}|\\p{Cf}){0,127}$": IdentifierOrReference;
}

export type IdentifierOrReference = {
    readonly oneOf: ReferenceObject[];
}

export type ComplexTypeProperties = {
    readonly $Kind:     Version;
    readonly $Abstract: Unicode;
    readonly $OpenType: Unicode;
    readonly $BaseType: Srid;
}

export type EntityContainer = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ComplexTypePatternProperties;
    readonly properties:           EntityContainerProperties;
    readonly required:             string[];
}

export type EntityContainerProperties = {
    readonly $Kind:    Version;
    readonly $Extends: Srid;
}

export type EntitySet = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ActionPatternProperties;
    readonly properties:           EntitySetProperties;
    readonly required:             string[];
}

export type EntitySetProperties = {
    readonly $Collection:                Collection;
    readonly $Type:                      Class;
    readonly $NavigationPropertyBinding: ReferenceObject;
    readonly $IncludeInServiceDocument:  Unicode;
}

export type Collection = {
    readonly description: string;
    readonly enum:        boolean[];
}

export type Class = {
    readonly description: string;
    readonly $ref:        Ref;
}

export enum Ref {
    DefinitionsAnnotation = "#/definitions/Annotation",
    DefinitionsQualifiedName = "#/definitions/QualifiedName",
    DefinitionsSimpleIdentifier = "#/definitions/SimpleIdentifier",
}

export type EntityType = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ComplexTypePatternProperties;
    readonly properties:           EntityTypeProperties;
    readonly required:             string[];
}

export type EntityTypeProperties = {
    readonly $Kind:      Version;
    readonly $HasStream: Unicode;
    readonly $Key:       Key;
    readonly $Abstract:  Unicode;
    readonly $OpenType:  Unicode;
    readonly $BaseType:  Srid;
}

export type Key = {
    readonly description: string;
    readonly type:        string;
    readonly items:       KeyItems;
}

export type KeyItems = {
    readonly description: string;
    readonly oneOf:       ItemsOneOf[];
}

export type ItemsOneOf = {
    readonly type:               string;
    readonly patternProperties?: OneOfPatternProperties;
}

export type OneOfPatternProperties = {
    readonly ".*": Srid;
}

export type EnumType = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    EnumTypePatternProperties;
    readonly properties:           EnumTypeProperties;
    readonly required:             string[];
}

export type EnumTypePatternProperties = {
    readonly "@":                                                                                     Class;
    readonly "^(_|\\p{L}|\\p{Nl})(_|\\p{L}|\\p{Nl}|\\p{Nd}|\\p{Mn}|\\p{Mc}|\\p{Pc}|\\p{Cf}){0,127}$": Srid;
}

export type EnumTypeProperties = {
    readonly $Kind:           Version;
    readonly $IsFlags:        Unicode;
    readonly $UnderlyingType: UnderlyingType;
}

export type UnderlyingType = {
    readonly description: string;
    readonly enum:        string[];
    readonly default:     string;
}

export type FunctionImport = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ActionPatternProperties;
    readonly properties:           FunctionImportProperties;
    readonly required:             string[];
}

export type FunctionImportProperties = {
    readonly $Function:                 Srid;
    readonly $EntitySet:                Srid;
    readonly $IncludeInServiceDocument: Unicode;
}

export type MaxLength = {
    readonly description: string;
    readonly type:        SRIDType;
    readonly minimum:     number;
}

export type NavigationProperty = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    NavigationPropertyPatternProperties;
    readonly properties:           NavigationPropertyProperties;
    readonly required:             string[];
}

export type NavigationPropertyPatternProperties = {
    readonly "^@":            ReferenceObject;
    readonly "^\\$OnDelete@": ReferenceObject;
}

export type NavigationPropertyProperties = {
    readonly $Kind:                  Version;
    readonly $Type:                  Class;
    readonly $Collection:            Unicode;
    readonly $Nullable:              Unicode;
    readonly $Partner:               Srid;
    readonly $ContainsTarget:        Unicode;
    readonly $ReferentialConstraint: ReferentialConstraint;
    readonly $OnDelete:              Version;
}

export type ReferentialConstraint = {
    readonly type:              string;
    readonly patternProperties: ReferentialConstraintPatternProperties;
}

export type ReferentialConstraintPatternProperties = {
    readonly "@":  Class;
    readonly ".*": Srid;
}

export type NavigationPropertyBinding = {
    readonly description:       string;
    readonly type:              string;
    readonly patternProperties: OneOfPatternProperties;
}

export type Parameter = {
    readonly description: string;
    readonly type:        string;
    readonly items:       ParameterItems;
}

export type ParameterItems = {
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ActionPatternProperties;
    readonly properties:           PropertyProperties;
    readonly required:             string[];
}

export type PropertyProperties = {
    readonly $Name?:         Class;
    readonly $Type:          Type;
    readonly $Collection:    Unicode;
    readonly $Nullable:      Unicode;
    readonly $MaxLength:     ReferenceObject;
    readonly $Unicode:       ReferenceObject;
    readonly $Precision:     ReferenceObject;
    readonly $Scale:         ReferenceObject;
    readonly $SRID:          ReferenceObject;
    readonly $Kind?:         Version;
    readonly $DefaultValue?: Annotation;
    readonly $BaseTerm?:     Srid;
    readonly $AppliesTo?:    AppliesTo;
}

export type AppliesTo = {
    readonly description: string;
    readonly type:        string;
    readonly items:       OneOf;
}

export type OneOf = {
    readonly type?: SRIDType;
    readonly enum?: string[];
}

export type Type = {
    readonly description: string;
    readonly default:     string;
    readonly $ref:        Ref;
}

export type Property = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ActionPatternProperties;
    readonly properties:           PropertyProperties;
}

export type QualifiedName = {
    readonly description: string;
    readonly type:        SRIDType;
    readonly pattern:     string;
}

export type ReturnType = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ActionPatternProperties;
    readonly properties?:          ReturnTypeProperties;
}

export type ReturnTypeProperties = {
    readonly $Type?:               Type;
    readonly $Collection?:         Unicode;
    readonly $Nullable?:           Unicode;
    readonly $MaxLength?:          ReferenceObject;
    readonly $Unicode?:            ReferenceObject;
    readonly $Precision?:          ReferenceObject;
    readonly $Scale?:              ReferenceObject;
    readonly $SRID?:               ReferenceObject;
    readonly $Include?:            Include;
    readonly $IncludeAnnotations?: IncludeAnnotations;
}

export type Include = {
    readonly description: string;
    readonly type:        string;
    readonly items:       IncludeItems;
}

export type IncludeItems = {
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly properties:           IncludeItemProperties;
    readonly patternProperties:    ActionPatternProperties;
    readonly required:             string[];
}

export type IncludeItemProperties = {
    readonly $Namespace: Class;
    readonly $Alias:     Class;
}

export type IncludeAnnotations = {
    readonly description: string;
    readonly type:        string;
    readonly items:       IncludeAnnotationsItems;
}

export type IncludeAnnotationsItems = {
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly properties:           IncludeAnnotationsItemProperties;
    readonly required:             string[];
}

export type IncludeAnnotationsItemProperties = {
    readonly $TermNamespace:   Class;
    readonly $TargetNamespace: Class;
    readonly $Qualifier:       Class;
}

export type Scale = {
    readonly description: string;
    readonly oneOf:       OneOf[];
}

export type Schema = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    SchemaPatternProperties;
    readonly properties:           SchemaProperties;
}

export type SchemaPatternProperties = {
    readonly "^@":                                                                                    ReferenceObject;
    readonly "^(_|\\p{L}|\\p{Nl})(_|\\p{L}|\\p{Nl}|\\p{Nd}|\\p{Mn}|\\p{Mc}|\\p{Pc}|\\p{Cf}){0,127}$": SchemaOneOf;
}

export type SchemaOneOf = {
    readonly oneOf: SchemaOneOfItem[];
}

export type SchemaOneOfItem = {
    readonly $ref?:        string;
    readonly description?: string;
    readonly type?:        string;
    readonly items?:       ReferenceObject;
}

export type SchemaProperties = {
    readonly $Alias:       Class;
    readonly $Annotations: Annotations;
}

export type Annotations = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    AnnotationsPatternProperties;
}

export type AnnotationsPatternProperties = {
    readonly "^[^$]": ReturnType;
}

export type Singleton = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ActionPatternProperties;
    readonly properties:           SingletonProperties;
    readonly required:             string[];
}

export type SingletonProperties = {
    readonly $Type:                      Class;
    readonly $Nullable:                  Unicode;
    readonly $NavigationPropertyBinding: ReferenceObject;
}

export type Term = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ActionPatternProperties;
    readonly properties:           PropertyProperties;
    readonly required:             string[];
}

export type TypeDefinition = {
    readonly description:          string;
    readonly type:                 string;
    readonly additionalProperties: boolean;
    readonly patternProperties:    ActionPatternProperties;
    readonly properties:           TypeDefinitionProperties;
    readonly required:             string[];
}

export type TypeDefinitionProperties = {
    readonly $Kind:           Version;
    readonly $UnderlyingType: Srid;
    readonly $MaxLength:      ReferenceObject;
    readonly $Unicode:        ReferenceObject;
    readonly $Precision:      ReferenceObject;
    readonly $Scale:          ReferenceObject;
    readonly $SRID:           ReferenceObject;
}

export type CSDLPatternProperties = {
    readonly "^(_|\\p{L}|\\p{Nl})(_|\\p{L}|\\p{Nl}|\\p{Nd}|\\p{Mn}|\\p{Mc}|\\p{Pc}|\\p{Cf}){0,127}(\\.(_|\\p{L}|\\p{Nl})(_|\\p{L}|\\p{Nl}|\\p{Nd}|\\p{Mn}|\\p{Mc}|\\p{Pc}|\\p{Cf}){0,127})*$": ReferenceObject;
}

export type CSDLProperties = {
    $Version:         string;
    readonly $EntityContainer: string;
    readonly $Reference:       Reference;
}

export type Reference = {
    readonly description:       string;
    readonly type:              string;
    readonly patternProperties: ReferencePatternProperties;
}

export type ReferencePatternProperties = {
    readonly ".*": ReturnType;
}

export type PropertyNames = {
    readonly maxLength: number;
}
