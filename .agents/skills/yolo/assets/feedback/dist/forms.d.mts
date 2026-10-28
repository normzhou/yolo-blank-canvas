export declare const forms: ({
    format_version: number;
    id: string;
    version: string;
    title: string;
    description: string;
    mode: string;
    input_schema: {
        type: string;
        properties: {
            observed: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            expected: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            reproduction: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            context: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            need?: undefined;
            impact?: undefined;
            proposal?: undefined;
            question?: undefined;
            attempts?: undefined;
            message?: undefined;
        };
        required: string[];
        additionalProperties: boolean;
    };
    form: {
        fields: {
            field: string;
            widget: string;
            label: string;
            help: string;
        }[];
    };
    result_schema: {
        type: string;
        properties: {};
        required: never[];
        additionalProperties: boolean;
    };
    protocol: {
        id: string;
        version: string;
    };
    sha256: string;
} | {
    format_version: number;
    id: string;
    version: string;
    title: string;
    description: string;
    mode: string;
    input_schema: {
        type: string;
        properties: {
            observed?: undefined;
            expected?: undefined;
            reproduction?: undefined;
            need: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            impact: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            proposal: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            context: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            question?: undefined;
            attempts?: undefined;
            message?: undefined;
        };
        required: string[];
        additionalProperties: boolean;
    };
    form: {
        fields: {
            field: string;
            widget: string;
            label: string;
            help: string;
        }[];
    };
    result_schema: {
        type: string;
        properties: {};
        required: never[];
        additionalProperties: boolean;
    };
    protocol: {
        id: string;
        version: string;
    };
    sha256: string;
} | {
    format_version: number;
    id: string;
    version: string;
    title: string;
    description: string;
    mode: string;
    input_schema: {
        type: string;
        properties: {
            observed?: undefined;
            expected?: undefined;
            reproduction?: undefined;
            need?: undefined;
            impact?: undefined;
            proposal?: undefined;
            question: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            attempts: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            context: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            message?: undefined;
        };
        required: string[];
        additionalProperties: boolean;
    };
    form: {
        fields: {
            field: string;
            widget: string;
            label: string;
            help: string;
        }[];
    };
    result_schema: {
        type: string;
        properties: {};
        required: never[];
        additionalProperties: boolean;
    };
    protocol: {
        id: string;
        version: string;
    };
    sha256: string;
} | {
    format_version: number;
    id: string;
    version: string;
    title: string;
    description: string;
    mode: string;
    input_schema: {
        type: string;
        properties: {
            observed?: undefined;
            expected?: undefined;
            reproduction?: undefined;
            need?: undefined;
            impact?: undefined;
            proposal?: undefined;
            question?: undefined;
            attempts?: undefined;
            message: {
                type: string;
                minLength: number;
                maxLength: number;
            };
            context: {
                type: string;
                minLength: number;
                maxLength: number;
            };
        };
        required: string[];
        additionalProperties: boolean;
    };
    form: {
        fields: {
            field: string;
            widget: string;
            label: string;
            help: string;
        }[];
    };
    result_schema: {
        type: string;
        properties: {};
        required: never[];
        additionalProperties: boolean;
    };
    protocol: {
        id: string;
        version: string;
    };
    sha256: string;
})[];
