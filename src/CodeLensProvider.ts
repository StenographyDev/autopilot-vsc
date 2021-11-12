/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { FILETYPES, fetchStenographyAutopilot, escapeRegExp, CacheObject, CACHE_NAME } from './utils';
import { showInputBox, setStenographyAPIKey } from './extension';
export class CodelensProvider implements vscode.CodeLensProvider {


    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    cache: CacheObject;
    context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext, cache: CacheObject) {
        this.cache = cache;
        this.context = context;


        console.log('codelens provider constructor: ' + JSON.stringify(cache));

        vscode.workspace.onDidChangeConfiguration((_) => {
            console.log('onDidChangeConfiguration');
            this._onDidChangeCodeLenses.fire();
        });

        vscode.workspace.onDidSaveTextDocument(async (document) => {
            console.log('onDidSaveTextDocument + ' + document.fileName);
            this.cache['documentCache'][document.fileName] = null;
            this.cache['codeLensCache'][document.fileName] = null;
            await this.context.workspaceState.update(CACHE_NAME, this.cache);

            this._onDidChangeCodeLenses.fire();
        });
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        console.log('provideCodeLenses ? ' + vscode.workspace.getConfiguration().get('stenography.codeLensMode'));
        
        if (vscode.workspace.getConfiguration().get('stenography.codeLensMode')) {
            const STENOGRAPHY_API_KEY: string | null | undefined = vscode.workspace.getConfiguration().get('stenography.apiKey');
            if (STENOGRAPHY_API_KEY === undefined || STENOGRAPHY_API_KEY === null || STENOGRAPHY_API_KEY === '') {
                console.error('No API key set');
                return [];
            }
    
            
    
            const filename: string = document.fileName;
            const fullFileName: string[] | undefined = document.fileName.split('.');
            const fileType: string | undefined = fullFileName.slice(-1)[0];
            let language = FILETYPES[fileType];
    
            if (!language) {
                console.log('provideCodeLenses: language not found');
                return [];
            }
    
    
            if (this.cache.maxedOutInvocations) {
                console.log('maxed out invocations');
                const newDatetime = new Date().getTime();
                if (Date.parse(this.cache.lastChecked.toString()) + (1000 * 60 * 60 * 24)   < newDatetime) {
                    console.log('last checked 24 hours ago -- seeing if invocations reset ' + new Date().toLocaleString());
                    return vscode.window.withProgress({
                        location: vscode.ProgressLocation.Window,
                        cancellable: false,
                        title: 'Checking Stenography Plan'
                    }, async (progress) => {
                        progress.report({ increment: 0 });
                        fetchStenographyAutopilot(STENOGRAPHY_API_KEY!, document.getText(), language, true).then((response) => {
                            if (response.error) {
                                vscode.window.showErrorMessage(response.error.message);
                                console.log('response: ' + JSON.stringify(response));
                                this.cache.lastChecked = new Date(newDatetime);
                                this.context.workspaceState.update(CACHE_NAME, this.cache); // TODO: does this need to be awaited or is that a nice to have?
                                return [];
                            } else {
                                console.log('response: ' + JSON.stringify(response));
                                this.cache.maxedOutInvocations = false;
                                this.cache.lastChecked = new Date(newDatetime);
                                this.context.workspaceState.update(CACHE_NAME, this.cache); // TODO: does this need to be awaited or is that a nice to have?
                            }
                            progress.report({ increment: 100 });
                        });
                        return [];
                    });     
                } else {
                    return [];
                }
            }
    
            this.codeLenses = [];
    
            if (filename in this.cache.codeLensCache && this.cache.codeLensCache[filename] !== null) {
                console.log('cache hit');
                for (let i = 0; i < this.cache.codeLensCache[filename]!.length; i++) {
                    const codeLensWrapper = [];
                    const codeLensObj = this.cache.codeLensCache[filename]![i];
                    const regex = new RegExp(escapeRegExp(codeLensObj.boundTo), 'g');
    
                    const text = document.getText();
                    let matches;
                    while ((matches = regex.exec(text)) !== null) {
                        const line = document.lineAt(document.positionAt(matches.index).line);
                        const textRange = new vscode.Range(line.range.start, line.range.end);
    
                        if (textRange) {
                            console.log('adding codelens w command');
                            codeLensWrapper.push(new vscode.CodeLens(textRange, codeLensObj.command));
                        }
                    }
                    this.codeLenses.push(...codeLensWrapper);
                }
    
                return this.codeLenses;
            } else {
                this.cache.codeLensCache[filename] = []; // prevent dupe calls
                console.log('cache miss');
                return vscode.window.withProgress({
                    location: vscode.ProgressLocation.Window,
                    cancellable: false,
                    title: 'Fetching from Stenography Autopilot'
                }, async (progress) => {
                    try {
                        progress.report({ increment: 0 });
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
                                        this.cache.maxedOutInvocations = true;
                                        this.cache.lastChecked = new Date();
                                        this.context.workspaceState.update(CACHE_NAME, this.cache);
                                        vscode.window.showErrorMessage(errorMessage); 
                                    }

                                    return [];
                                }
        
                                
                                if (data.error) {
                                    console.error(data.error);
                                    vscode.window.showErrorMessage(data.error);
                                    return [];
                                }
                                data.code_blocks.forEach((block: any) => {
                                    var firstLine = document.lineAt(block.startPosition.row - 1);
                                    var textRange = new vscode.Range(firstLine.range.start, firstLine.range.end);
                                    let command = {
                                        title: "<stenography autopilot />",
                                        tooltip: block.stenographyResult.pm,
                                        command: "stenography.codelensAction",
                                        arguments: [block.stenographyResult.pm]
                                    };
                                    this.codeLenses.push(new vscode.CodeLens(textRange, command));
                                    this.cache.codeLensCache[filename]!.push({
                                        boundTo: block.stenographyResult.code,
                                        command: command
                                    });
                                });
            
                                return this.codeLenses;
                            } catch (err:any) {
                                console.error(err);
                                vscode.window.showErrorMessage(err);
                                return [];
                            }
                        }).catch((err: any) => {
                            console.error(err.error);
                            vscode.window.showErrorMessage(err.error);
                            return [];
                        });
                    } catch (err) {
                        console.error(err);
                        return [];
                    }
                });
            }
        } else {
            console.log('no stenography codeLensMode');
            return [];
        }
    }

    public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
        if (vscode.workspace.getConfiguration("stenography.autopilotSettings").get("codeLensMode", true)) {
            console.log('active');
            codeLens.command = {
                title: '<stenography autopilot />',
                tooltip: `- generated by stenography autopilot [ 🚗👩‍✈️ ]`,
                command: "stenography.codelensAction",
                arguments: ["Argument 1", false]
            };
            return codeLens;
        }
        return null;
    }
}
