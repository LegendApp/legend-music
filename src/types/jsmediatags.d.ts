declare module "jsmediatags" {
    export interface JsMediaTagsError {
        type: string;
        info: string;
    }

    export interface JsMediaTagsPicture {
        data: number[] | Uint8Array | ArrayBuffer | ArrayBufferView;
        format?: string | null;
        mime?: string | null;
        description?: string | null;
        type?: string | null;
    }

    export interface JsMediaTagsTags {
        title?: string;
        artist?: string;
        album?: string;
        track?: string;
        picture?: JsMediaTagsPicture | null;
        pictures?: JsMediaTagsPicture[] | null;
        [key: string]: unknown;
    }

    export interface JsMediaTagsSuccess {
        type: string;
        version?: string;
        tags: JsMediaTagsTags;
    }

    export interface JsMediaTagsReader {
        setTagsToRead(tags: string[]): JsMediaTagsReader;
        setFileReader(fileReader: unknown): JsMediaTagsReader;
        setTagReader(tagReader: unknown): JsMediaTagsReader;
        read(callbacks: {
            onSuccess: (data: JsMediaTagsSuccess) => void;
            onError: (error: JsMediaTagsError) => void;
        }): void;
    }

    export interface JsMediaTagsModule {
        Reader: new (file: string | ArrayBuffer | Blob) => JsMediaTagsReader;
        read(
            file: string | ArrayBuffer | Blob,
            callbacks: {
                onSuccess: (data: JsMediaTagsSuccess) => void;
                onError: (error: JsMediaTagsError) => void;
            },
        ): void;
    }

    const jsmediatags: JsMediaTagsModule;
    export default jsmediatags;
}

declare module "jsmediatags/build2/jsmediatags" {
    import type { JsMediaTagsModule } from "jsmediatags";

    export * from "jsmediatags";

    const jsmediatags: JsMediaTagsModule;
    export default jsmediatags;
}
