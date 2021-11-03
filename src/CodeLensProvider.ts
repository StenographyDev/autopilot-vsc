import * as vscode from 'vscode';
import fetch from 'node-fetch';

const FILETYPES:any = {
	"ts": "typescript",
	"tsx": "tsx",
	"js": "javascript",
	"py": "python",
	"html": "html"
};

const STENOGRAPHY_API_KEY = vscode.workspace.getConfiguration().get('stenography.apiKey')

const fetchStenographyAutopilot = async (code: string, language: string, dryRun: boolean = true): Promise<any> => {

	let fetchUrl = 'https://stenography-worker.stenography.workers.dev/autopilot';

	let options = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ 
			"code": code, 
			"api_key": STENOGRAPHY_API_KEY, 
			"dry_run": dryRun, 
			"index_by_one": true, 
			"add_import": false, 
			"language": language, 
			"stenography_options": { 
				"audience": "pm",
				"stackoverflow": false,
				"populate": false
			} 
		})
	};

	try {
		const resp = await fetch(fetchUrl, options);

		const json: any = await resp.json();
		if (typeof json === 'string') {
			throw new Error(json);
		}
		return json;
	} catch (err: any) {
		console.error(err);
	}
};

/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {

    private codeLenses: vscode.CodeLens[] = [];
    private regex: RegExp;
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        this.regex = /const/g;

        // vscode.workspace.onDidChangeConfiguration((_) => {
        //     this._onDidChangeCodeLenses.fire();
        // });
    }

    documentsCache:any = {};
    codeLensesCache:any = {};

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {

        if (vscode.workspace.getConfiguration("stenography").get("enableCodeLens", true)) {
            const filename:string = document.fileName;
            console.log(filename);
            const fullFileName: string[] | undefined = document.fileName.split('.');
            const fileType: string | undefined = fullFileName.slice(-1)[0];
            let language = FILETYPES[fileType];

            this.codeLenses = [];
            if (filename in this.codeLensesCache) {
                this.codeLenses = this.codeLensesCache[filename];
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
                console.log(language)
                return fetchStenographyAutopilot(document.getText(), language, false).then((data: any) => {
                    console.log(data);
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
                        this.codeLensesCache[filename] = this.codeLenses;
                    });

                    console.log(this.codeLenses);
                    return this.codeLenses;
                });
            }

            // custom
            // var firstLine = document.lineAt(10);
            // var lastLine = document.lineAt(document.lineCount - 1);
            // var textRange = new vscode.Range(firstLine.range.start, firstLine.range.end);
            // let command = {
            //     command: "",
            //     title : "<your custom title based on lineText>"
            //  };
            // this.codeLenses.push(new vscode.CodeLens(textRange, command));

            // demo
            // const line = document.lineAt(document.positionAt(112).line);
            // // const indexOf = line.text.indexOf(matches[0]);
            // const regex = new RegExp(this.regex);
            // console.log(new RegExp(regex));
            // const position = new vscode.Position(9, 1);
            // const range = document.getWordRangeAtPosition(position, new RegExp(this.regex));
            // if (range) {
            //     this.codeLenses.push(new vscode.CodeLens(range));
            // }

            // const regex = new RegExp(this.regex);
            // const text = document.getText();
            // let matches;
            // while ((matches = regex.exec(text)) !== null) {
            //     const line = document.lineAt(document.positionAt(matches.index).line);
            //     console.log(line);
            //     const indexOf = line.text.indexOf(matches[0]);
            //     console.log(indexOf);
            //     const position = new vscode.Position(line.lineNumber, indexOf);
            //     console.log(position);
            //     const range = document.getWordRangeAtPosition(position, new RegExp(this.regex));
            //     console.log(range);
            //     if (range) {
            //         this.codeLenses.push(new vscode.CodeLens(range));
            //     }
            // }
            // return this.codeLenses;
        }
        return [];
    }

    public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
        console.log(codeLens);
        if (vscode.workspace.getConfiguration("stenography").get("enableCodeLens", true)) {
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
