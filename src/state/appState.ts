import { action, observable, runInAction } from 'mobx';
import { Cache, Fs } from '../services/Fs';
import * as path from 'path';

export class AppState {
    readingRemote: Promise<Array<any>>;
    readingLocal: Promise<Array<any>>;

    @observable
    localCache: Cache = {
        path: '.',
        files: new Array()
    };

    @observable
    remoteCache: Cache = {
        path: 'ftp://192.168.0.1',
        files: new Array()
    };

    @action
    readDirectory(dir: string, type: string = 'local') {
        if (type === 'local') {
            this.readingLocal = Fs.readDirectory(dir);

            this.readingLocal.then((files) => {
                console.log('yeah, got files', files);
                runInAction(() => {
                    this.localCache.files = files;
                    this.localCache.path = path.resolve(dir);
                });
            });
        }
    }

    test() {
        console.log('**click!!');
        this.localCache.path = '** click';
    }

    constructor() {
        // TODO: get initial path values ?
        this.readingRemote = Promise.resolve(Array());
        this.readingLocal = Promise.resolve(Array());
    }
}