/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { FILETYPES, fetchStenographyAutopilot, escapeRegExp, CacheObject, CACHE_NAME, fetchStenography, StenographyResponse, getFileType } from './utils';
import { showInputBox, setStenographyAPIKey } from './extension';
export class CodelensProvider implements vscode.CodeLensProvider {

    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    context: vscode.ExtensionContext;
    isProcessing: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        vscode.workspace.onDidChangeConfiguration((_) => {
            // console.log('onDidChangeConfiguration');
            this._onDidChangeCodeLenses.fire();
        });

        vscode.workspace.onDidSaveTextDocument(async (document) => {
            // console.log('onDidSaveTextDocument + ' + document.fileName);
            const cache = context.workspaceState.get<CacheObject>(CACHE_NAME);
            if (cache) {
                if (this.isProcessing) {
                    return;
                } else {
                    cache['codeLensCache'][document.fileName] = null;
                    this.context.workspaceState.update(CACHE_NAME, cache);

                    this._onDidChangeCodeLenses.fire();
                }
            } else {
                console.log('cache not found');
            }
        });
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        // console.log('provideCodeLenses ? ' + vscode.workspace.getConfiguration().get('stenography.codeLensMode'));
        
        if (vscode.workspace.getConfiguration().get('stenography.codeLensMode')) {
            const STENOGRAPHY_API_KEY: string | null | undefined = vscode.workspace.getConfiguration().get('stenography.apiKey');
            if (STENOGRAPHY_API_KEY === undefined || STENOGRAPHY_API_KEY === null || STENOGRAPHY_API_KEY === '') {
                console.error('No API key set');
                return [];
            }
    
            const filename: string = document.fileName;
            let language = getFileType(filename);
    
            if (!language) {
                // console.log('provideCodeLenses: language not found');
                return [];
            }
    
            const cache = this.context.workspaceState.get<CacheObject>(CACHE_NAME)!;
    
            if (cache.maxedOutInvocations) {
                const newDatetime = new Date().getTime();
                if (Date.parse(cache.lastChecked.toString()) + (1000 * 60 * 60)   < newDatetime) {
                    // console.log('last checked an hour ago -- seeing if invocations reset ' + new Date().toLocaleString());
                    return vscode.window.withProgress({
                        location: vscode.ProgressLocation.Window,
                        cancellable: false,
                        title: 'Checking Stenography Plan'
                    }, async (progress) => {
                        progress.report({ increment: 0 });
                        return fetchStenographyAutopilot(STENOGRAPHY_API_KEY!, document.getText(), language, true).then((response) => {
                            progress.report({ increment: 100 });
                            if (response.error) {
                                vscode.window.showErrorMessage(response.error.message);
                                // console.log('response: ' + JSON.stringify(response));
                                cache.lastChecked = new Date(newDatetime);
                                this.context.workspaceState.update(CACHE_NAME, cache);
                                this.isProcessing = false;
                                return [];
                            } else {
                                // console.log('response: ' + JSON.stringify(response));
                                this.context.workspaceState.update(CACHE_NAME, {
                                    documentCache: {},
                                    codeLensCache: {},
                                    maxedOutInvocations: false,
                                    lastChecked: new Date(),
                                });
                                this.isProcessing = false;
                                return [];
                            }
                        });
                    });     
                } else {
                    return [];
                }
            } else {
                // console.log('provideCodeLenses: cache.maxedOutInvocations: ' + cache.maxedOutInvocations);
            }

            this.codeLenses = [];
    
            if (filename in cache.codeLensCache && cache.codeLensCache[filename] !== null) {
                // console.log('provideCodeLenses: cache hit');
                if (cache.codeLensCache[filename]!.length === 0) {
                    setTimeout(() => {
                        this._onDidChangeCodeLenses.fire(); // todo does this need to have a final break after a certain amount of time? or does the existence of codeLensesCache entail it will resolve?
                    }, 1000);
                }
                for (let i = 0; i < cache.codeLensCache[filename]!.length; i++) {
                    const codeLensWrapper = [];
                    const codeLensObj = cache.codeLensCache[filename]![i];
                    const regex = new RegExp(escapeRegExp(codeLensObj.boundTo), 'g');
    
                    const text = document.getText();
                    let matches;
                    while ((matches = regex.exec(text)) !== null) {
                        const line = document.lineAt(document.positionAt(matches.index).line);
                        const textRange = new vscode.Range(line.range.start, line.range.end);
    
                        if (textRange) {
                            codeLensWrapper.push(new vscode.CodeLens(textRange, codeLensObj.command));
                        }
                    }
                    this.codeLenses.push(...codeLensWrapper);
                }
    
                return this.codeLenses;
            } else {
                // console.log('provideCodeLenses: cache miss: ' + this.isProcessing);
                if (this.isProcessing) {
                    return this.codeLenses;
                }

                cache.codeLensCache[filename] = []; // prevent dupe calls
                cache.documentCache[filename] = [];

                return this.context.workspaceState.update(CACHE_NAME, cache).then(() => {
                    return vscode.window.withProgress({
                        location: vscode.ProgressLocation.Window,
                        cancellable: true,
                        title: 'Fetching from Stenography Autopilot'
                    }, async (progress) => {
                        try {
                            progress.report({ increment: 0 });
                            this.isProcessing = true;
                            return fetchStenographyAutopilot(STENOGRAPHY_API_KEY!, document.getText(), language, false).then((data: any) => {
                                try {
            
                                    if (data.error) {
                                        let errorMessage = data.error.message;
                                        if(errorMessage.includes('Unauthorized POST')) {
                                            errorMessage = 'Please set a valid API key in the settings.\nYou can get an API key here: https://stenography.dev/dashboard. Refer to README for more help!';
                                            vscode.window.showErrorMessage(errorMessage, 'Input API Key', 'Get New API Key').then(async (value) => {
                                                if (value === 'Input API Key') {
                                                    showInputBox().then((apiKey) => {
                                                        if (apiKey) {
                                                            setStenographyAPIKey(apiKey);
                                                        }
                                                    }).catch((err) => {
                                                        vscode.window.showErrorMessage(`Stenography Autopilot: err: ${err}`);
                                                    });
                                                }
    
                                                if (value === 'Get New API Key') {
                                                    vscode.env.openExternal(vscode.Uri.parse('https://stenography.dev/dashboard'));
                                                }
                                                    
                                            });
                                        }
                                        else if (errorMessage.includes('monthly limit')) {
                                            cache.maxedOutInvocations = true;
                                            cache.lastChecked = new Date();
                                            this.context.workspaceState.update(CACHE_NAME, cache);
                                            vscode.window.showErrorMessage(errorMessage, 'Upgrade Plan').then(async (value) => {
                                                if (value === 'Upgrade Plan') {
                                                    vscode.env.openExternal(vscode.Uri.parse('https://stenography.dev/dashboard'));
                                                }
                                            });; 
                                        } else {
                                            vscode.window.showErrorMessage(data.error);
                                        }
    
                                        return [];
                                    }
                                                
                                    data.code_blocks.forEach((block: any) => {
                                        var firstLine = document.lineAt(block.startPosition.row - 1);
                                        var textRange = new vscode.Range(firstLine.range.start, firstLine.range.end);
                                        let command = {
                                            title: "<stenography autopilot />",
                                            tooltip: block.stenographyResult.pm,
                                            command: "stenography.codelensAction",
                                            arguments: [block]
                                        };


                                        this.codeLenses.push(new vscode.CodeLens(textRange, command));
                                        cache.codeLensCache[filename]!.push({
                                            boundTo: block.stenographyResult.code,
                                            command: command
                                        });
                                    });
                                    this.context.workspaceState.update(CACHE_NAME, cache);
                                    this.isProcessing = false;

                                    return this.codeLenses;
                                } catch (err:any) {
                                    console.error(err);
                                    vscode.window.showErrorMessage(err);
                                    this.isProcessing = false;
                                    return this.codeLenses;
                                }
                            })
                            .catch((err: any) => {
                                console.error(err.error);
                                vscode.window.showErrorMessage(err.error);
                                return this.codeLenses;
                            });
                        } catch (err) {
                            console.error(err);
                            return this.codeLenses;
                        }
                    });
                });
                
            }
        } else {
            // console.log('no stenography codeLensMode');
            return [];
        }
    }

    public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
        if (vscode.workspace.getConfiguration("stenography.autopilotSettings").get("codeLensMode", true)) {
            const STENOGRAPHY_API_KEY: string | null | undefined = vscode.workspace.getConfiguration().get('stenography.apiKey');
            const editor = vscode.window.activeTextEditor;
            console.log('resolving: ' + JSON.stringify(codeLens, null, 2));
            if (editor) {
                const filename: string | undefined = editor.document.fileName;

                
                // const cache = this.context.workspaceState.get<CacheObject>(CACHE_NAME);
                // console.log('-- doc cache --');
                // console.log(cache?.documentCache)
                // console.log(filename)
                // if (cache?.documentCache?.[filename]?.code_blocks) {
                //     console.log('-- codeLens cache --');
                //     console.log(cache?.documentCache?.[filename]);
                //     const codeBlock = cache.documentCache[filename].code_blocks.find((block: any) => {
                //         console.log(block.startPosition.row - 1 + ' :: ' + codeLens.range.start.line);
                //         return block.startPosition.row - 1 === codeLens.range.start.line;
                //     });

                //     if (codeBlock) {
                //         console.log('codeBlock: ' + JSON.stringify(codeBlock));

                //         const command = {
                //             title: '<autopilot 2 />',
                //             tooltip: codeBlock.stenographyResult.pm,
                //             command: "stenography.codelensAction",
                //             arguments: [codeBlock]
                //         };
                //         codeLens.command = command;

                //         cache.codeLensCache[filename]!.push({
                //             boundTo: codeBlock.stenographyResult.code,
                //             command: command
                //         });

                //         return codeLens;
                //     }
                // }

                // TODO - only gets first line and not rest of code block
                // is it possible to call both dry run and real run at same time, load real run into cache?

                const cache = this.context.workspaceState.get<CacheObject>(CACHE_NAME);
                console.log('-- codeLens cache --');
                console.log(cache?.documentCache?.[filename]);

                const codeBlock = cache!.documentCache[filename].find((block: any) => {
                    console.log(block.startPosition.row - 1 + ' :: ' + codeLens.range.start.line);
                    return block.startPosition.row - 1 === codeLens.range.start.line;
                });


                if (codeBlock) {
                    console.log('codeBlock: ' + JSON.stringify(codeBlock));
                    return fetchStenography(STENOGRAPHY_API_KEY!, codeBlock.code, getFileType(editor.document.fileName)).then(async (data: StenographyResponse) => {
                        const command = {
                            title: '<stenography autopilot />',
                            tooltip: data.pm,
                            command: "stenography.codelensAction",
                            arguments: [data]
                        };

                        codeLens.command = command;
                        const cache = this.context.workspaceState.get<CacheObject>(CACHE_NAME)!;
        
        
                        cache.codeLensCache[filename]!.push({
                            boundTo: codeBlock.code,
                            command: command
                        });
                        this.context.workspaceState.update(CACHE_NAME, cache);
                        return codeLens;
                    });
                }
            }
        }
        return null;
    }
}
