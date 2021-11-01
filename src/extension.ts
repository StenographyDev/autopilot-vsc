/* eslint-disable @typescript-eslint/naming-convention */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import fetch from 'node-fetch';

let STENOGRAPHY_API_KEY: string | null | undefined;

interface StenographyResponse {
	pm: string,
	code: string,
	metadata: any
}

interface AutopilotResponse {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	invocation_counter: number,
	// eslint-disable-next-line @typescript-eslint/naming-convention
	code_blocks?: [CodeBlock]
	error?: any
}

interface CodeBlock {
	stenographyResult: StenographyResponse,
	startPosition: any,
	endPosition: any
}

                                  /*
                                  This code is a simple HTTP client that sends a POST request to the stenography service.
The code in this answer is not meant to be run, but rather as an example of how you can use the stenography API.
                                  - generated by stenography autopilot [ 🚗👩‍✈️ ] 
                                  */
const fetchStenographyAutopilot = async (code: string, language: string, dryRun: boolean = true): Promise<AutopilotResponse> => {

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
		return { error: err, invocation_counter: -1 };
	}
};

const FILETYPES:any = {
	"ts": "typescript",
	"js": "javascript",
	"py": "python",
	"html": "html"
};

const logic = async (editor: vscode.TextEditor | undefined, isDryRun = true) => {
	try {
		STENOGRAPHY_API_KEY = vscode.workspace.getConfiguration().get('stenography.apiKey');
		let ZERO_COLUMN = vscode.workspace.getConfiguration().get('stenography.autopilotSettings.zeroCol');

		let code: string | undefined = editor?.document.getText();
		const filename: string[] | undefined = editor?.document.fileName.split('.');
		const fileType: string | undefined = filename?.slice(-1)[0];
	
		let language:string;
		
  /*
  This code is checking if the file type of the current document matches any of the keys in FILETYPES. If it does, then language will be set to that value.
  - generated by stenography autopilot [ 🚗👩‍✈️ ] 
  */
		if (fileType) {
			language = FILETYPES[fileType];
		} else {
			vscode.window.showErrorMessage("Language not yet supported");
			return;
		}
	
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			cancellable: false,
			title: 'Fetching from Stenography Autopilot'
     /*
     This code is a stenography autopilot. It will generate the code blocks for you and add them to your editor.
     - generated by stenography autopilot [ 🚗👩‍✈️ ] 
     */
		}, async (progress) => {
			progress.report({ increment: 0 });
			if (code) {
				if (editor) {
	
					const res = await fetchStenographyAutopilot(code, language, isDryRun);
					console.log(res);
					if (res.error) {
						let errorMessage = res.error.message;
						if(errorMessage.includes('Unauthorized POST')) {
							errorMessage = 'Please set a valid API key in the settings.\nYou can get an API key here: https://stenography.dev/dashboard. Refer to README for more help!';
						}

						vscode.window.showErrorMessage(errorMessage);
						return;
					}
	
					const linesA:any = [];
	

					for (let i = 0; i < res.code_blocks!.length; i++) {
						const codeBlock = res.code_blocks![i];
						
						const column = codeBlock.startPosition.column - 1;
						const columnPlacement = ZERO_COLUMN ? 1 : column;
						
						const lineAboveNewLine = new vscode.Position(
							codeBlock.startPosition.row - 1,
							columnPlacement
						);
						
						if(isDryRun) {
							linesA.push({ line: lineAboveNewLine, codeRes: `dry run -- stenography will explain this code block!` });
						} else {
							linesA.push({ line: lineAboveNewLine, codeRes: codeBlock.stenographyResult.pm });
						}		
					}
	
					switch (language) {
						case 'typescript':
						case 'javascript':
							editor?.edit(edit => {
								linesA.forEach((line:any) => {
									edit.insert(new vscode.Position(line.line.line, 0), '\n');
								});
							}).then(() => {
								editor?.edit(edit => {
									linesA.forEach((line:any, idx:number) => {
										edit.insert(new vscode.Position(line.line.line + idx, line.line.character), `${' '.repeat(line.line.character)}/*\n${' '.repeat(line.line.character)}${line.codeRes.replace('*/', '').trim()}\n${' '.repeat(line.line.character)}- generated by stenography autopilot [ 🚗👩‍✈️ ] \n${' '.repeat(line.line.character)}*/`);
									});
								});
							});
							break;
						case 'python':
							editor?.edit(edit => {
								linesA.forEach((line:any) => {
									edit.insert(new vscode.Position(line.line.line, 0), '\n');
								});
							}).then(() => {
								editor?.edit(edit => {
									linesA.forEach((line:any, idx:number) => {
										edit.insert(new vscode.Position(line.line.line + idx, line.line.character), `${' '.repeat(line.line.character)}'''\n${' '.repeat(line.line.character)}${line.codeRes.replace('\'\'\'', '').trim()}\n${' '.repeat(line.line.character)}- generated by stenography autopilot [ 🚗👩‍✈️ ] \n${' '.repeat(line.line.character)}'''`);
									});
								});
							});
							break;
						case 'html':
							editor?.edit(edit => {
								linesA.forEach((line:any) => {
									edit.insert(new vscode.Position(line.line.line, 0), '\n');
								});
							}).then(() => {
								editor?.edit(edit => {
									linesA.forEach((line:any, idx:number) => {
										edit.insert(new vscode.Position(line.line.line + idx, line.line.character), `${' '.repeat(line.line.character)}<!--\n${' '.repeat(line.line.character)}${line.codeRes.replace('-->', '').trim()}\n${' '.repeat(line.line.character)}- generated by stenography autopilot [ 🚗👩‍✈️ ] \n${' '.repeat(line.line.character)}-->`);
									});
								});
							});
							break;
						default:
							vscode.window.showErrorMessage("Language not yet supported");
							break;
						}
	
				}
	
				progress.report({ increment: 100 });
			} else {
				vscode.window.showErrorMessage("Code context is null");
			}
		});
	} catch (err:any) {
		vscode.window.showErrorMessage("Unkown error: " + err.message);
	}
};


       /*
       This code is registering a command in vscode.
The command will be called "stenography.autopilot" and it will call the logic function with false as an argument.
This means that we are not running dry, so we want to actually run stenography on our code.
       - generated by stenography autopilot [ 🚗👩‍✈️ ] 
       */
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "stenography" is now active!');


	let disposable = vscode.commands.registerCommand('stenography.autopilot', async () => {
		const editor = vscode.window.activeTextEditor;
		await logic(editor, false);
	});

	let disposableDryRun = vscode.commands.registerCommand('stenography.autopilot-dryrun', async () => {
		const editor = vscode.window.activeTextEditor;
		await logic(editor, true);
	});

	context.subscriptions.push(disposableDryRun);
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }
