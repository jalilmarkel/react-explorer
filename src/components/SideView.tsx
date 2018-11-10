import * as React from "react";
import { inject, Provider, observer } from 'mobx-react';
import { Toolbar } from './Toolbar';
import { Statusbar } from './Statusbar';
import { FileList } from './FileList';
import { AppState } from "../state/appState";
import { LoginDialog } from "./LoginDialog";
import { FileState } from "../state/fileState";

interface SideViewProps {
}

interface InjectedProps extends SideViewProps{
    appState: AppState;
}

interface SideViewState{
    fileCache: FileState;
}

@inject('appState')
@observer
export class SideView extends React.Component<SideViewProps, SideViewState>{
    constructor(props:{}) {
        super(props);

        const { appState } = this.injected;
        const cache: FileState = appState.addCache();

        this.state = {
            fileCache: cache
        };

        cache.cd('.');
    }

    private get injected() {
        return this.props as InjectedProps;
    }

    private onValidation = (dir:string):boolean => {
        return true;
    }

    private onClose = () => {
        // login cancelled
        const { fileCache } = this.state;
        // doesn't work: it keeps the previous fs
        fileCache.revertPath();
    }

    render() {
        const { fileCache } = this.state;
        const needLogin = fileCache.status === 'login';

        return (
            <Provider fileCache={fileCache}>
                <div className="sideview">
                    {needLogin && <LoginDialog isOpen={needLogin} onValidation={this.onValidation} onClose={this.onClose} />}
                    <Toolbar />
                    <FileList />
                    <Statusbar />
                </div>
            </Provider>
        );
    }
}