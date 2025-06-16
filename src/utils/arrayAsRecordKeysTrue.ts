import { linked, type ObservableParam } from "@legendapp/state";

function arrayAsRecordKeysTrue<T extends object>(arr$: ObservableParam<T[]>, fieldKey: keyof T) {
    return linked<Record<string, boolean>>({
        get: () => {
            const record: Record<string, boolean> = {};
            const value = arr$.get();
            for (let i = 0; i < value.length; i++) {
                const v = value[i];
                record[v[fieldKey]] = true;
            }
            return record;
        },
        set: ({ value }) => {
            if (value) {
                arr$.set(
                    Object.keys(value)
                        .filter((key) => value[key])
                        .map((key) => arr$.get()[key]),
                );
            } else {
                arr$.set(value);
            }
        },
    });
}

export { arrayAsRecordKeysTrue };
