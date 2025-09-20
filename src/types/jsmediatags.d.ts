interface JsMediaTagsError {
    type: string;
    info: string;
}

interface JsMediaTagsPicture {
    data: number[] | Uint8Array | ArrayBuffer | ArrayBufferView;
    format?: string | null;
    mime?: string | null;
    description?: string | null;
    type?: string | null;
}

interface JsMediaTagsTags {
    title?: string;
    artist?: string;
    album?: string;
    track?: string;
    picture?: JsMediaTagsPicture | null;
    [key: string]: unknown;
}

interface JsMediaTagsSuccess {
    type: string;
    version?: string;
    tags: JsMediaTagsTags;
}

interface JsMediaTagsReader {
    setTagsToRead(tags: string[]): JsMediaTagsReader;
    setFileReader(fileReader: unknown): JsMediaTagsReader;
    setTagReader(tagReader: unknown): JsMediaTagsReader;
    read(callbacks: {
        onSuccess: (data: JsMediaTagsSuccess) => void;
        onError: (error: JsMediaTagsError) => void;
    }): void;
}

interface JsMediaTagsModule {
    Reader: new (file: string | ArrayBuffer | Blob) => JsMediaTagsReader;
    read(
        file: string | ArrayBuffer | Blob,
        callbacks: {
            onSuccess: (data: JsMediaTagsSuccess) => void;
            onError: (error: JsMediaTagsError) => void;
        },
    ): void;
}

declare module "jsmediatags" {
    const jsmediatags: JsMediaTagsModule;
    export default jsmediatags;
}

declare module "jsmediatags/build2/jsmediatags" {
    const jsmediatags: JsMediaTagsModule;
    export default jsmediatags;
}
