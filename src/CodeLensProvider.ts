/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { FILETYPES, fetchStenographyAutopilot, escapeRegExp, CacheObject, CACHE_NAME } from './utils';
 
export class CodelensProvider implements vscode.CodeLensProvider {

    
    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    documentsCache:any = {};
    codeLensesCache:any = {};
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
            
            this.codeLensesCache[document.fileName] = null;
            this.documentsCache[document.fileName] = null;
            this._onDidChangeCodeLenses.fire();
        });
    }

    

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        const STENOGRAPHY_API_KEY: string|undefined = vscode.workspace.getConfiguration().get('stenography.apiKey');
        console.log('provideCodeLenses');

        if (this.cache.maxedOutInvocations) {
            console.log('maxed out invocations');
            const newDatetime = new Date().getTime();
            if (Date.parse(this.cache.lastChecked.toString()) + 1000 * 60 * 60 * 24  < newDatetime) {
                console.log('last checked 24 hours ago -- seeing if invocations reset');
                this.cache.lastChecked = new Date(newDatetime);
                this.context.workspaceState.update(CACHE_NAME, this.cache); // TODO: does this need to be awaited or is that a nice to have?
            }
            return [];
        }

        if (vscode.workspace.getConfiguration("stenography.autopilotSettings").get("codeLensMode", false)) {
            return vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                cancellable: false,
                title: 'Fetching from Stenography Autopilot'
            }, async (progress) => {
                progress.report({ increment: 0 });
            
                const filename:string = document.fileName;
                const fullFileName: string[] | undefined = document.fileName.split('.');
                const fileType: string | undefined = fullFileName.slice(-1)[0];
                let language = FILETYPES[fileType];

                const codeLenses: vscode.CodeLens[] = [];
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
                                // console.log(new vscode.CodeLens(textRange, codeLensObj.command));
                                codeLensWrapper.push(new vscode.CodeLens(textRange, codeLensObj.command));
                            }
                        }
                        this.codeLenses.push(...codeLensWrapper);
                        console.log(codeLenses);
                    }
                    
                    console.log(codeLenses);
                    return this.codeLenses;
                }
                
                if (filename in this.documentsCache && this.documentsCache[filename] !== null) {
                    console.log("Already in cache");
                    if (document.getText() !== this.documentsCache[filename]) {
                        console.log("Text changed");
                    }
                } else {
                    this.documentsCache[filename] = document.getText();
                    console.log("Added to cache");

                    // use dry run call to see if code changed enough to justify a run
                    // how many code blocks changed
                    // in future, a smart autopilot will be able to detect changes in the code and run only if there are enough changes

                    return fetchStenographyAutopilot(STENOGRAPHY_API_KEY!, document.getText(), language, false).then((data: any) => {
                        console.log(data);
                        this.codeLensesCache[filename] = [];
                        if (data.error) {
                            console.error(data.error);
                            return [];
                        }
                        data.code_blocks.forEach((block: any) => {
                            var firstLine = document.lineAt(block.startPosition.row - 1);
                            var textRange = new vscode.Range(firstLine.range.start, firstLine.range.end);
                            let command = {
                                title : "<stenography autopilot />",
                                tooltip: block.stenographyResult.pm,
                                command: "stenography.codelensAction",
                                arguments: [block.stenographyResult.pm]
                            };
                            this.codeLenses.push(new vscode.CodeLens(textRange, command));
                            this.codeLensesCache[filename].push({
                                boundTo: block.stenographyResult.code,
                                command: command
                            });
                        });

                        return this.codeLenses;
                    });
                }
                
                return this.codeLenses;
            });
        }
            
        return [];
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
