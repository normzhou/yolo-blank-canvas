export declare function boundedCache(ttl: any): {
    get(key: any): any;
    delete: (key: any) => void;
    clear(): void;
    set(key: any, value: any): void;
};
export declare function conditionalReads(): {
    scope(db: any, origin: any, credential: any): boolean;
    clear(): void;
    read(key: any, fetcher: any, parse: any, method?: string): Promise<any>;
};
export declare function timings(name: any): {
    time: <T>(key: string, action: () => Promise<T>) => Promise<T>;
    finish: (response: any) => any;
};
