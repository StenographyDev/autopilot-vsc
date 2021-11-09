/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { FILETYPES, fetchStenographyAutopilot, escapeRegExp } from './utils';
 
export class CodelensProvider implements vscode.CodeLensProvider {

    
    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        // NEW STRAT: on save, run autopilot on the document
        // for every other document change check if code block has changed, if so remove codelens
        // else just change its line with the document text
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    documentsCache:any = {};
    codeLensesCache:any = {};

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        const STENOGRAPHY_API_KEY: string|undefined = vscode.workspace.getConfiguration().get('stenography.apiKey');
        console.log('provideCodeLenses');

        if (vscode.workspace.getConfiguration("stenography.autopilotSettings").get("codeLensMode", false)) {
            
            return vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                cancellable: false,
                title: 'Fetching from Stenography Autopilot'
            }, async (progress) => {
                progress.report({ increment: 0 });
            
                const filename:string = document.fileName;
                console.log(filename);
                const fullFileName: string[] | undefined = document.fileName.split('.');
                const fileType: string | undefined = fullFileName.slice(-1)[0];
                let language = FILETYPES[fileType];

                const codeLenses: vscode.CodeLens[] = [];
                this.codeLenses = [];

                if (filename in this.codeLensesCache) {
                    console.log('cache hit');
                    for (let i = 0; i < this.codeLensesCache[filename].length; i++) {
                        const codeLensWrapper = [];
                        const codeLensObj = this.codeLensesCache[filename][i];
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
                
                if (filename in this.documentsCache) {
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
                tooltip: `The command will be called "stenography.autopilot" and it will call the logic function with false as an argument.\n
                
                This means that we are not running dry, so we want to actually run stenography on our code.\n
                
                - generated by stenography autopilot [ 🚗👩‍✈️ ]`,
                command: "stenography.codelensAction",
                arguments: ["Argument 1", false]
            };
            return codeLens;
        }
        return null;
    }
}
