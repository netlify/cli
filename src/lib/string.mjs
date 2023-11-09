// @ts-expect-error TS(7006) FIXME: Parameter 't' implicitly has an 'any' type.
export const capitalize = function (t) {
    // @ts-expect-error TS(7006) FIXME: Parameter 'string' implicitly has an 'any' type.
    return t.replace(/(^\w|\s\w)/g, (string) => string.toUpperCase());
};
