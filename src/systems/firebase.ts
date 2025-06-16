import { observablePrimitive } from "@legendapp/state";
import { isString } from "@legendapp/tools";

import { initializeApp } from "firebase/app";
import type { User, UserCredential } from "firebase/auth";
import {
    off as _off,
    onValue as _onValue,
    push as _push,
    ref as _refDatabase,
    set as _set,
    update as _update,
    type DatabaseReference,
    type DataSnapshot,
    type EventType,
    getDatabase,
    increment,
    onChildAdded,
    onChildChanged,
    onChildRemoved,
    orderByChild,
    type Query,
    query,
    remove,
    startAt,
    type Unsubscribe,
} from "firebase/database";
import {
    getDownloadURL as _getDownloadURL,
    ref as _refStorage,
    deleteObject,
    getBlob,
    getMetadata,
    getStorage,
    list,
    listAll,
    type StorageReference,
    updateMetadata,
    uploadBytes,
    uploadString,
} from "firebase/storage";

const id = "legend-kit";
// const idNum = '439794906579';

const config = {
    apiKey: "AIzaSyCDY6Qp98pp3gcZ9lLK9EKxJOW2yo7KrQA",
    authDomain: `${id}.firebaseapp.com`,
    databaseURL: `https://${id}-default-rtdb.europe-west1.firebasedatabase.app`,
    projectId: id,
    // storageBucket: `${id}.appspot.com`,
    // messagingSenderId: idNum,
    // appId: `1:${idNum}:web:b76ec934bc0d614fe9c0da`,
};

function createQuery(query: Query | string) {
    return isString(query) ? refDB(query) : query;
}

const firebaseApp = initializeApp(config);
// const _auth = getAuth(firebaseApp);
const _db = getDatabase(firebaseApp);
const _storage = getStorage(firebaseApp);

// const auth = {
//     createUserWithEmailAndPassword: (email: string, password: string) =>
//         _createUserWithEmailAndPassword(_auth, email, password),
//     EmailAuthProvider,
//     GoogleAuthProvider,
//     linkWithCredential,
//     OAuthProvider,
//     onAuthStateChanged: (nextOrObserver: NextOrObserver<User>, error?: ErrorFn, completed?: CompleteFn) =>
//         _onAuthStateChanged(_auth, nextOrObserver, error, completed),
//     reauthenticateWithCredential,
//     sendPasswordResetEmail: (email: string) => _sendPasswordResetEmail(_auth, email),
//     signInWithCredential: (credential: AuthCredential) => _signInWithCredential(_auth, credential),
//     signInWithEmailAndPassword: (email: string, password: string) =>
//         _signInWithEmailAndPassword(_auth, email, password),
//     signInWithPopup: (provider: AuthProvider) => _signInWithPopup(_auth, provider),
//     unlink,
//     updateEmail,
//     updatePassword,
//     get currentUser() {
//         return _auth.currentUser;
//     },
//     signOut: () => _auth.signOut(),
//     sendEmailVerification,
//     firebaseAuth: _auth,
// };

const refDB = (path?: string) => _refDatabase(_db, path);
const onValue = (
    query: Query | string,
    callback: (snapshot: DataSnapshot) => void,
    cancelCallback?: (error: Error) => unknown,
) => _onValue(createQuery(query), callback, cancelCallback);

const database = {
    generateId: () => _push(refDB()).key,
    increment,
    off: (
        query: Query | string,
        eventType?: EventType,
        callback?: (snapshot: DataSnapshot, previousChildName?: string | null) => unknown,
    ) => _off(createQuery(query), eventType, callback),
    onChildAdded,
    onChildChanged: (
        query: Query | string,
        callback: (snapshot: DataSnapshot) => void,
        cancelCallback?: (error: Error) => unknown,
    ) => onChildChanged(createQuery(query), callback, cancelCallback),
    onChildRemoved,
    onValue,
    orderByChild,
    push: (parent?: DatabaseReference, value?: unknown) => _push(parent || refDB(), value),
    remove: (query: DatabaseReference | string) => remove(createQuery(query) as DatabaseReference),
    query,
    ref: refDB,
    set: (ref: DatabaseReference | string, value: unknown) => _set(createQuery(ref) as DatabaseReference, value),
    startAt,
    update: (query: DatabaseReference | string, values: object) =>
        _update(createQuery(query) as DatabaseReference, values),
    updateBatch: (values: object) => _update(refDB(), values),
    valueOnce: <T = any>(valueQyer: Query | string, cb?: (value: T) => void) =>
        new Promise<T>((resolve) => {
            let unsubscribe: Unsubscribe | undefined;
            unsubscribe = onValue(valueQyer, (snap) => {
                if (unsubscribe) {
                    unsubscribe();
                    unsubscribe = undefined;
                }
                const val = snap.val();
                cb?.(val);
                resolve(val);
            });
        }),
    onOnlineChange: (cb: (value: boolean) => void) => onValue(refDB(".info/connected"), (snap) => cb(snap.val())),
};

const storage = {
    deleteObject,
    getBlob,
    getDownloadURL: (query: StorageReference | string) =>
        _getDownloadURL(isString(query) ? (_refStorage(_storage, query) as StorageReference) : query),
    getMetadata,
    list,
    listAll,
    ref: (url?: string) => _refStorage(_storage, url),
    uploadBytes,
    uploadString,
    updateMetadata,
};

const currentUser$ = observablePrimitive<string>();
// auth.onAuthStateChanged((user) => {
//     const uid = user?.uid;
//     if (uid) {
//         currentUser$.set(uid);
//     } else {
//         currentUser$.delete();
//     }
// });

export { currentUser$, database, storage };
export type { DataSnapshot, DatabaseReference, Query, User, UserCredential };

export function initializeFirebase() {
    // This funtion does nothing but importing it runs the creation side effects we need
}
