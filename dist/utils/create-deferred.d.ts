declare const createDeferred: <T>() => {
    promise: Promise<T>;
    reject: (reason: unknown) => void;
    resolve: (value: T) => void;
};
export default createDeferred;
//# sourceMappingURL=create-deferred.d.ts.map