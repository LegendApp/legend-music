import ksuid from "ksuid";

export function generateId() {
    return ksuid.randomSync().string;
}
