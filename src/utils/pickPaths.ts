// Helper type to create a nested structure from a path
type NestedPick<T, Path extends string> = Path extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
        ? { [K in Key]: NestedPick<T[Key], Rest> }
        : never
    : Path extends keyof T
      ? { [K in Path]: T[Path] }
      : never;

// Helper type to merge a union of objects into a single object type
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

// Merge all path objects into a single object type, correctly handling nesting
type MergePathObjects<T, Paths extends readonly string[]> = UnionToIntersection<NestedPick<T, Paths[number]>>;

// Helper function to pick from an object based on a single path
function pickPath(source: any, path: string[], target: any): void {
    const [key, ...rest] = path;

    // If source doesn't have this key, nothing to do
    if (!(key in source)) {
        return;
    }

    const value = source[key];

    // If this is the last part of the path, copy the value
    if (rest.length === 0) {
        target[key] = value;
        return;
    }

    // Handle different types of values
    if (Array.isArray(value)) {
        // For arrays, we need to process each item
        if (!target[key]) {
            target[key] = [];
        }

        for (let i = 0; i < value.length; i++) {
            if (!target[key][i]) {
                target[key][i] = {};
            }
            pickPath(value[i], rest, target[key][i]);
        }
    } else if (value && typeof value === "object") {
        // For objects, continue picking with the rest of the path
        if (!target[key]) {
            target[key] = {};
        }
        pickPath(value, rest, target[key]);
    }
    // For primitive values with a non-empty rest path, we can't go deeper
}

export function pickPaths<T extends object, Paths extends readonly string[]>(
    obj: T,
    paths: Paths,
): MergePathObjects<T, Paths> {
    const result = {} as any;

    // Process each path
    for (const path of paths) {
        pickPath(obj, path.split("."), result);
    }

    return result;
}
