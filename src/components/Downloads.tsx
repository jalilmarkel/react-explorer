import * as React from 'react';
import { ITreeNode, Tree, Icon, Intent, Classes, IconName, ProgressBar } from '@blueprintjs/core';
import { AppState } from '../state/appState';
import { inject } from 'mobx-react';
import { Batch } from '../transfers/batch';
import { reaction, toJS, IReactionDisposer, IObservableArray } from 'mobx';
import i18next from 'i18next';
import { withNamespaces, WithNamespaces } from 'react-i18next';
import { formatBytes } from '../utils/formatBytes';
import { FileTransfer } from '../transfers/fileTransfer';
import classnames from 'classnames';
import { intentClass } from '@blueprintjs/core/lib/esm/common/classes';
import { AppAlert } from './AppAlert';
import CONFIG from '../config/appConfig';
import { isWin } from '../utils/platform';

const TYPE_ICONS: { [key: string]: IconName } = {
    img: 'media',
    any: 'document',
    snd: 'music',
    vid: 'mobile-video',
    exe: 'application',
    arc: 'compressed',
    doc: 'align-left',
    cod: 'code',
};

interface Props extends WithNamespaces {
    hide: boolean;
}

interface InjectedProps extends Props {
    appState: AppState;
}

interface Expandables {
    [key: string]: boolean;
}

interface State {
    nodes: ITreeNode[];
    expandedNodes: Expandables;
}

interface NodeData {
    transferElement: FileTransfer;
    batchId: number;
}

@inject('appState')
class DownloadsClass extends React.Component<Props, State> {
    private disposer: IReactionDisposer;
    private appState: AppState;

    constructor(props: Props) {
        super(props);

        this.appState = this.injected.appState;

        this.state = {
            nodes: this.getTreeData(this.appState.transfers),
            expandedNodes: {},
        };

        this.installReaction();

        // nodes are only generated after the transfers have changed
        // changing the language will cause a new render, but with the
        // same nodes (using the previous language)
        // we listen for the languageChange event and re-generated the nodes
        // with the updated language
        this.bindLanguageChange();
    }

    private installReaction(): void {
        this.disposer = reaction(
            (): IObservableArray<Batch> => {
                return toJS(this.appState.transfers);
            },
            (transfers: Batch[]): void => {
                this.setState({ nodes: this.getTreeData(transfers) });
            },
            {
                delay: 500,
            },
        );
    }

    private bindLanguageChange = (): void => {
        i18next.on('languageChanged', this.onLanguageChanged);
    };

    private unbindLanguageChange = (): void => {
        i18next.off('languageChanged', this.onLanguageChanged);
    };

    public onLanguageChanged = (/* lang: string */): void => {
        const nodes = this.getTreeData(this.appState.transfers);
        this.setState({ nodes });
    };

    private get injected(): InjectedProps {
        return this.props as InjectedProps;
    }

    componentWillUnMount(): void {
        this.unbindLanguageChange();
    }

    private handleNodeCollapse = (node: ITreeNode): void => {
        const { expandedNodes } = this.state;
        expandedNodes[node.id] = false;
        node.isExpanded = false;

        this.setState(this.state);
    };

    private handleNodeExpand = (node: ITreeNode): void => {
        const { expandedNodes } = this.state;
        expandedNodes[node.id] = true;
        node.isExpanded = true;
        this.setState(this.state);
    };

    showTransferAlert(): Promise<boolean> {
        const { t } = this.injected;

        return AppAlert.show(t('DIALOG.STOP_TRANSFER.MESSAGE'), {
            cancelButtonText: t('DIALOG.STOP_TRANSFER.BT_CANCEL'),
            confirmButtonText: t('DIALOG.STOP_TRANSFER.BT_OK'),
            intent: Intent.WARNING,
            icon: 'warning-sign',
        });
    }

    async onCloseClick(transferId: number): Promise<void> {
        const appState = this.appState;
        const transfer = appState.getTransfer(transferId);

        if (transfer.hasEnded) {
            appState.removeTransfer(transferId);
        } else {
            const cancel = await this.showTransferAlert();
            if (cancel) {
                appState.removeTransfer(transferId);
            }
        }
    }

    onNodeDoubleClick = (node: ITreeNode, nodePath: number[]): void => {
        // no first-level: this is a file
        if (nodePath.length > 1) {
            const transfer = (node.nodeData as NodeData).transferElement;
            const batchId = (node.nodeData as NodeData).batchId;
            if (transfer.status === 'done') {
                this.appState.openTransferedFile(batchId, transfer.file);
            }
        }
    };

    onNodeClick = (node: ITreeNode, nodePath: number[]): void => {
        // first-level node
        if (nodePath.length === 1) {
            const { expandedNodes } = this.state;
            node.isExpanded = !node.isExpanded;
            expandedNodes[node.id] = node.isExpanded;

            this.setState(this.state);
        }
    };

    getIntent(transfer: Batch): Intent {
        console.log(transfer.status, transfer);
        const status = transfer.status;
        let intent: Intent = Intent.NONE;
        if (!status.match(/queued|calculating/)) {
            intent = status.match(/error|cancelled/)
                ? Intent.DANGER
                : status.match(/started/)
                ? Intent.PRIMARY
                : Intent.SUCCESS;
            if (status !== 'started') {
                // some errors
                const errors = transfer.errors;
                if (errors) {
                    console.log('errors', errors, transfer.elements.length);
                    intent = errors === transfer.elements.length ? Intent.DANGER : Intent.WARNING;
                }
            }
        }

        return intent;
    }

    getTransferIcon(intent: Intent): JSX.Element {
        return <Icon icon="dot" className={Classes.TREE_NODE_ICON} intent={intent}></Icon>;
    }

    getFileIcon(filetype: string): IconName {
        return (filetype && TYPE_ICONS[filetype]) || TYPE_ICONS['any'];
    }

    createTransferLabel(transfer: Batch, className: string): JSX.Element {
        const { t } = this.injected;
        const sizeFormatted = formatBytes(transfer.size);
        const ended = transfer.hasEnded;
        const transferSize = (transfer.status !== 'calculating' && sizeFormatted) || '';
        const currentSize = ended ? sizeFormatted : formatBytes(transfer.progress);
        const percent = transfer.status === 'calculating' ? 0 : transfer.progress / transfer.size;
        const errors = transfer.errors;
        const rightLabel = ended
            ? errors
                ? t('DOWNLOADS.FINISHED_ERRORS')
                : t('DOWNLOADS.FINISHED')
            : t('DOWNLOADS.PROGRESS', { current: currentSize, size: transferSize });

        return (
            <span className={className}>
                {!ended && <ProgressBar value={percent} intent={Intent.PRIMARY} animate={false}></ProgressBar>}
                {rightLabel}
                <Icon
                    className="action"
                    onClick={(e) => {
                        e.stopPropagation();
                        this.onCloseClick(transfer.id);
                    }}
                    intent="danger"
                    icon="small-cross"
                />
            </span>
        );
    }

    createFileRightLabel(file: FileTransfer): JSX.Element {
        const { t } = this.injected;
        const fileProgress = formatBytes(file.progress);
        const fileSize = formatBytes(file.file.length);
        const started = file.status.match(/started/);
        const queued = file.status.match(/queued/);
        const done = file.status.match(/done/);
        const isError = file.status.match(/error/);
        const isCancelled = file.status.match(/cancelled/);
        let errorMessage = '';

        const spanClass = classnames({
            [Classes.INTENT_DANGER]: isError,
            [Classes.INTENT_SUCCESS]: done,
        });

        if (isError) {
            errorMessage = (isError && file.error && file.error.message) || t('DOWNLOADS.ERROR');
        } else if (isCancelled) {
            errorMessage = (isCancelled && file.error && file.error.message) || t('DOWNLOADS.CANCELLED');
        }

        return (
            <span className={spanClass}>
                {started && t('DOWNLOADS.PROGRESS', { current: fileProgress, size: fileSize })}
                {queued && t('DOWNLOADS.QUEUED')}
                {!started && !queued && (done ? fileSize : errorMessage)}
            </span>
        );
    }

    getTreeData(transfers: Batch[]): ITreeNode[] {
        const treeData: ITreeNode[] = [];

        for (const transfer of transfers) {
            const intent = this.getIntent(transfer);
            const className = intentClass(intent);
            const sep = isWin ? '\\' : '/';
            const node: ITreeNode = {
                id: transfer.id,
                hasCaret: true,
                icon: this.getTransferIcon(intent),
                label: (
                    <span className={className}>
                        {' '}
                        {transfer.srcName} ??? {transfer.dstName}
                    </span>
                ),
                secondaryLabel: this.createTransferLabel(transfer, className),
                isExpanded: !!this.state.expandedNodes[transfer.id],
                childNodes: [],
            };

            let i = 0;
            for (const element of transfer.elements) {
                if (!element.file.isDir || element.status === 'error') {
                    const id = transfer.id + '_' + i;
                    const { file } = element;
                    const filetype = file.type;

                    node.childNodes.push({
                        id: id,
                        icon: file.isDir ? 'folder-close' : this.getFileIcon(filetype),
                        label: element.subDirectory ? element.subDirectory + sep + file.fullname : file.fullname,
                        secondaryLabel: this.createFileRightLabel(element),
                        nodeData: {
                            transferElement: element,
                            batchId: transfer.id,
                        },
                    });
                    i++;
                    // <Icon className="action" onClick={() => this.onCloseClick(transfer.id, i)} intent="danger" icon="small-cross" /></span>
                }
            }

            treeData.push(node);
        }

        return treeData;
    }

    componentWillUnmount(): void {
        this.disposer();
    }

    renderTransferTree(): JSX.Element {
        // console.log('render');
        const { nodes } = this.state;
        const { t } = this.props;

        if (nodes.length) {
            return (
                <Tree
                    className={`downloads ${CONFIG.CUSTOM_SCROLLBAR_CLASSNAME}`}
                    contents={nodes}
                    onNodeCollapse={this.handleNodeCollapse}
                    onNodeExpand={this.handleNodeExpand}
                    onNodeClick={this.onNodeClick}
                    onNodeDoubleClick={this.onNodeDoubleClick}
                />
            );
        } else {
            return (
                <div className="downloads empty">
                    <Icon iconSize={80} icon="document" color="#d9dde0"></Icon>
                    <p style={{ textAlign: 'center' }}>{t('DOWNLOADS.EMPTY_TITLE')}</p>
                </div>
            );
        }
    }

    // shouldComponentUpdate() {
    //     console.time('Downloads Render');
    //     return true;
    // }

    // componentDidUpdate() {
    //     console.timeEnd('Downloads Render');
    // }

    render(): React.ReactNode {
        if (this.props.hide) {
            return null;
        } else {
            return this.renderTransferTree();
        }
    }
}

const Downloads = withNamespaces()(DownloadsClass);

export { Downloads };
