import type { Observable } from "@legendapp/state";

export function arrayRemove<T>(arr: T[] | Observable<T[]>, item: T) {
    const index = arr.indexOf(item);
    if (index > -1) {
        arr.splice(index, 1);
    }
    return arr;
}
