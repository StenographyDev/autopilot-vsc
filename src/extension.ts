/* eslint-disable @typescript-eslint/naming-convention */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { CodelensProvider } from './CodelensProvider';
import { CacheObject, CACHE_NAME, getFileType } from './utils'; 
import { comment, commentGenerator } from './comment';

let STENOGRAPHY_API_KEY: string | null | undefined;

/*
This code is creating a new input box that asks the user to enter their stenography API key.
If they do, it will set the stenographyAPIKey variable in our extension to their entered value and show an information message.
Otherwise, if they cancel or don't enter anything, it will return undefined and we can handle that case with try/catch logic.
- generated by stenography autopilot [ 🚗👩‍✈️ ] 
*/
export async function showInputBox() {

	const result: string | undefined = await vscode.window.showInputBox({
		value: '',
		placeHolder: 'Input your Stenography API Key',
	});

	try {
		if (result) {
			setStenographyAPIKey(result);
			vscode.window.showInformationMessage("API Key successfully added to stenography session!");
		} else {
			throw new Error('result is undefined');
		}
	} catch (error) {
		console.error("Invalid key -- catch"); // todo some 401 magic from actual outbound call
		return null;
	}
}

                             /*
                             This code is setting the api key in the stenography extension settings.
                             - generated by stenography autopilot [ 🚗👩‍✈️ ] 
                             */
export const setStenographyAPIKey = (key: string) => {
	STENOGRAPHY_API_KEY = key;
	vscode.workspace.getConfiguration("stenography").update("apiKey", key, true);
};


interface StenographyResponse {
	pm: string,
	code: string,
	metadata: any
}

interface AutopilotResponse {
	invocation_counter: number,
	code_blocks?: [CodeBlock],
	error?: any
}

interface CodeBlock {
	stenographyResult: StenographyResponse,
	startPosition: any,
	endPosition: any
}



                                         /*
                                         This code is a function that takes in code, language and dryRun as parameters. It then makes an API call to the stenography service using fetch.
                                         - generated by stenography autopilot [ 🚗👩‍✈️ ] 
                                         */
export const fetchStenographyAutopilot = async (code: string, language: string, dryRun: boolean = true): Promise<AutopilotResponse> => {

	let fetchUrl = 'https://stenography-worker.stenography.workers.dev/autopilot';


	let options = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ 
			"code": code, 
			"api_key": STENOGRAPHY_API_KEY?.trim(), 
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
	"tsx": "tsx",
	"js": "javascript",
	"py": "python",
	"html": "html",
	"rb": "ruby",
};

const logic = async (editor: vscode.TextEditor | undefined, isDryRun = true) => {
	try {
		if (vscode.workspace.getConfiguration().get('stenography.apiKey')) {
			STENOGRAPHY_API_KEY = vscode.workspace.getConfiguration().get('stenography.apiKey');
		} else {
			if (!STENOGRAPHY_API_KEY) {
				const result = await showInputBox();
				if (result) {
					setStenographyAPIKey(result);
				} else {
					return;
				}
			}
		}
		
		let ZERO_COLUMN = vscode.workspace.getConfiguration().get('stenography.autopilotSettings.zeroCol');

		let code: string | undefined = editor?.document.getText();
		const filename: string[] | undefined = editor?.document.fileName.split('.');
		const fileType: string | undefined = filename?.slice(-1)[0];
	
		let language:string;

		
  /*
  This code is checking if the file type of the current document matches any of the keys in FILETYPES. If it does, then language will be set to that value.
  - generated by stenography autopilot [ 🚗👩‍✈️ ] 
  */
  /*
  This code is checking if the file type is supported. If it's not, then an error message will be shown to the user and they can't proceed with their code.
  - generated by stenography autopilot [ 🚗👩‍✈️ ] 
  */
		if (fileType) {
			language = FILETYPES[fileType];
			if (language == undefined) {
				vscode.window.showErrorMessage("Language not yet supported. Currently supported languages: " + Object.keys(FILETYPES).join(', '));
				return;
			}
		} else {
			vscode.window.showErrorMessage("Language not yet supported. Currently supported languages: " + Object.keys(FILETYPES).join(', '));
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
					let keystrokesSaved = 0;
					let languageError = false;

					const res = await fetchStenographyAutopilot(code, language, isDryRun);
					console.log(res);
     /*
     This code is checking if the response from the server contains an error. If it does, then we show a message to the user with that error.
     - generated by stenography autopilot [ 🚗👩‍✈️ ] 
     */
					if (res.error) {
						let errorMessage = res.error.message;
						if(errorMessage.includes('Unauthorized POST')) {
							errorMessage = 'Please set a valid API key.\nYou can get an API key here: https://stenography.dev/dashboard. Refer to README for more help!';
						}

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
						return;
					}
	
					const linesA:any = [];
	

     /*
     This code is looping through the code blocks in the result object.
     - generated by stenography autopilot [ 🚗👩‍✈️ ] 
     */
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
							keystrokesSaved += codeBlock.stenographyResult.pm.length;
						}		
					}
	
					switch (language) {
						case 'typescript':
						case 'tsx':
						case 'javascript':
                    /*
                    This code is adding a new line character to the end of each line in linesA.
                    - generated by stenography autopilot [ 🚗👩‍✈️ ] 
                    */
							editor?.edit(edit => {
								linesA.forEach((line:any) => {
									edit.insert(new vscode.Position(line.line.line, 0), '\n');
								});
               /*
               This code is adding a comment to the top of each line in the code.
               - generated by stenography autopilot [ 🚗👩‍✈️ ] 
               */
							}).then(() => {
								editor?.edit(edit => {
									linesA.forEach((line:any, idx:number) => {
										edit.insert(new vscode.Position(line.line.line + idx, line.line.character), `${' '.repeat(line.line.character)}/*\n${' '.repeat(line.line.character)}${line.codeRes.replace('*/', '').split('\n').map((ln:string , idx:number) => {
											if (idx === 0) {
												return ln;
											} 
											return `${' '.repeat(line.line.character)}${ln}`;
										}).join('\n').trim()}\n${' '.repeat(line.line.character)}- generated by stenography autopilot [ 🚗👩‍✈️ ] \n${' '.repeat(line.line.character)}*/`);
									});
								});
							});
							break;
						case 'ruby':
						case 'python':
                    /*
                    This code is adding a new line character to the end of each line in linesA.
                    - generated by stenography autopilot [ 🚗👩‍✈️ ] 
                    */
							editor?.edit(edit => {
								linesA.forEach((line:any) => {
									edit.insert(new vscode.Position(line.line.line, 0), '\n');
								});
							}).then(() => {
								editor?.edit(edit => {
									linesA.forEach((line:any, idx:number) => {
										edit.insert(new vscode.Position(line.line.line + idx, line.line.character), `${' '.repeat(line.line.character)}'''\n${' '.repeat(line.line.character)}${line.codeRes.replace('\'\'\'', '').replaceAll("\'", "\\'").split('\n').map((ln:string , idx:number) => {
											if (idx === 0) {
												return ln;
											} 
											return `${' '.repeat(line.line.character)}${ln}`;
										}).join('\n').trim()}\n${' '.repeat(line.line.character)}- generated by stenography autopilot [ 🚗👩‍✈️ ] \n${' '.repeat(line.line.character)}'''`);
									});
								});
							});
							break;
						case 'html':
                    /*
                    This code is adding a new line character to the end of each line in linesA.
                    - generated by stenography autopilot [ 🚗👩‍✈️ ] 
                    */
							editor?.edit(edit => {
								linesA.forEach((line:any) => {
									edit.insert(new vscode.Position(line.line.line, 0), '\n');
								});
               /*
               This code is adding a comment to the end of each line in the code.
               - generated by stenography autopilot [ 🚗👩‍✈️ ] 
               */
							}).then(() => {
								editor?.edit(edit => {
									linesA.forEach((line:any, idx:number) => {
										edit.insert(new vscode.Position(line.line.line + idx, line.line.character), `${' '.repeat(line.line.character)}<!--\n${' '.repeat(line.line.character)}${line.codeRes.replace('-->', '').split('\n').map((ln:string , idx:number) => {
											if (idx === 0) {
												return ln;
											} 
											return `${' '.repeat(line.line.character)}${ln}`;
										}).join('\n').trim()}\n${' '.repeat(line.line.character)}- generated by stenography autopilot [ 🚗👩‍✈️ ] \n${' '.repeat(line.line.character)}-->`);
									});
								});
							});
							break;
						default:
							vscode.window.showErrorMessage("Language not yet supported");
							languageError = true;
							break;
						}

						if (isDryRun && !languageError) {
							vscode.window.showInformationMessage(`Stenography dry run complete!\n\n${res.code_blocks!.length} invocations added!`);
						} else {
							vscode.window.showInformationMessage(`Stenography autopilot complete!\n\nStenography used ${res.code_blocks!.length} invocations added and saved ${keystrokesSaved} keystrokes!`);
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

export const stenographyStatusBar = (autopilotStatusBarItem: vscode.StatusBarItem) => {
	return autopilotStatusBarItem;
};
       /*
       This code is registering a command that will be called when the user presses `ctrl+shift+p` and then types "stenography.autopilot".
       It also registers another command that will be called when the user presses `ctrl+shift+p` and then types "stenography.autopilotdryrun"
       and it does not make any changes to the file, just shows what would happen if you did.
       - generated by stenography autopilot [ 🚗👩‍✈️ ] 
       */
export async function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "stenography" is now active!');

	const defaultData: CacheObject = {
		documentCache: {},
		codeLensCache: {},
		maxedOutInvocations: false,
		lastChecked: new Date(),
		isProcessing: false,
	};
	
	if (context.workspaceState.get<CacheObject>(CACHE_NAME)) {
		await context.workspaceState.update(CACHE_NAME, {
			documentCache: {},
			codeLensCache: {},
			maxedOutInvocations: false,
			lastChecked: new Date(),
		});
	}

	context.workspaceState.get<CacheObject>(CACHE_NAME, defaultData); // TODO: is this necessary?
	await context.workspaceState.update(CACHE_NAME, defaultData);
	// console.log('cache: ' + JSON.stringify(cache));

	STENOGRAPHY_API_KEY = vscode.workspace.getConfiguration().get('stenography.apiKey');

	if (STENOGRAPHY_API_KEY === undefined || STENOGRAPHY_API_KEY === null || STENOGRAPHY_API_KEY === '') {
		vscode.window.showErrorMessage('Stenography Autopilot: Please provide an API key!', 'Input API Key', 'Get New API Key').then(async (value) => {
			if (value === 'Input API Key') {
				showInputBox().then((apiKey) => {
					if (apiKey) {
						setStenographyAPIKey(apiKey);
					} else {
						vscode.window.showErrorMessage('Invalid API Key from input box');
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

	const codelensProvider = new CodelensProvider(context);
    vscode.languages.registerCodeLensProvider("*", codelensProvider);

    vscode.commands.registerCommand("stenography.codelensAction", (args: any) => {
		vscode.window.showInformationMessage(args.stenographyResult.pm, 'Commit to File', 'Share').then((value) => {
			const editor = vscode.window.activeTextEditor;
			if (value === 'Commit to File') {
				console.log('Commit to File');
				
				if (editor) {
					comment(editor, getFileType(editor?.document.fileName), args);
				} else {
					vscode.window.showErrorMessage('No active editor');
				}
			}
			if (value === 'Share') {
				if (editor) {
					vscode.env.openExternal(vscode.Uri.parse(`https://carbon.now.sh/?l=${getFileType(editor?.document.fileName)}&code=${encodeURIComponent(commentGenerator({
						codeRes: args.stenographyResult.pm
					}, 0, getFileType(editor?.document.fileName)) + '\n\n' + args.stenographyResult.code)}`));
				} else {
					vscode.window.showErrorMessage('No active editor');
				}
			}
		});
    });

	let toggleCodeLens = vscode.commands.registerCommand('stenography.toggleCodeLens', async () => {
		await vscode.workspace.getConfiguration().update('stenography.codeLensMode', !vscode.workspace.getConfiguration().get('stenography.codeLensMode'), true);
		vscode.window.showInformationMessage(`CodeLens mode is now ${vscode.workspace.getConfiguration().get('stenography.codeLensMode') ? 'active': 'inactive'}`);
	});

	let resetCache = vscode.commands.registerCommand('stenography.resetCache', async () => {
		await context.workspaceState.update(CACHE_NAME, {
			documentCache: {},
			codeLensCache: {},
			maxedOutInvocations: false,
			lastChecked: new Date(),
		});
		vscode.window.showInformationMessage('Cache reset');
	});

	let setKeyDisposable = vscode.commands.registerCommand('stenography.setKey', async () => {
		await showInputBox();
	});


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
	context.subscriptions.push(setKeyDisposable);
	context.subscriptions.push(toggleCodeLens);
	context.subscriptions.push(resetCache);
}

// this method is called when your extension is deactivated
export async function deactivate(context: vscode.ExtensionContext) {
	await context.workspaceState.update(CACHE_NAME, null);
	console.log('deactivating');
}
