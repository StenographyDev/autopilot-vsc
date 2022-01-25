/* eslint-disable @typescript-eslint/naming-convention */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import { CodelensProvider } from './CodelensProvider';
import { CacheObject, CACHE_NAME, getFileType } from './utils'; 
import { comment, commentGenerator } from './comment';

let STENOGRAPHY_API_KEY: string | null | undefined;

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



export const fetchStenographyAutopilot = async (code: string, language: string, dryRun: boolean = true): Promise<AutopilotResponse> => {

	let fetchUrl = 'https://stenography-worker.stenography.workers.dev/autopilot';

	try {

		const resp = await axios.post(fetchUrl, JSON.stringify({ 
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
		}),
		{
			headers: { 'Content-Type': 'application/json' }
		});

		const json: any = await resp.data;

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
	"jsx": "javascript",
	"js": "javascript",
	"py": "python",
	"html": "html",
	"rb": "ruby",
	"vue": "vue",
	"sol": "solidity",
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
		}, async (progress) => {
			progress.report({ increment: 0 });
			if (code) {
				if (editor) {
					let keystrokesSaved = 0;
					let languageError = false;

					const res = await fetchStenographyAutopilot(code, language, isDryRun);
					console.log(res);
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
						case 'solidity':
						case 'javascript':
							editor?.edit(edit => {
								linesA.forEach((line:any) => {
									edit.insert(new vscode.Position(line.line.line, 0), '\n');
								});
							}).then(() => {
								editor?.edit(edit => {
									linesA.forEach((line:any, idx:number) => {
										edit.insert(new vscode.Position(line.line.line + idx, line.line.character), `${' '.repeat(line.line.character)}/*\n${' '.repeat(line.line.character)}${line.codeRes.replace('*/', '').split('\n').map((ln:string , idx:number) => {
											if (idx === 0) {
												return ln;
											} 
											return `${' '.repeat(line.line.character)}${ln}`;
										}).join('\n').trim()}\n${' '.repeat(line.line.character)}${vscode.workspace.getConfiguration().get('stenography.generatedBy') ? '- generated by stenography autopilot [ 🚗👩‍✈️ ]\n': ''}${' '.repeat(line.line.character)}*/`);
									});
								});
							});
							break;
						case 'ruby':
						case 'python':
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
										}).join('\n').trim()}\n${' '.repeat(line.line.character)}${vscode.workspace.getConfiguration().get('stenography.generatedBy') ? '- generated by stenography autopilot [ 🚗👩‍✈️ ]\n': ''}${' '.repeat(line.line.character)}'''`);
									});
								});
							});
							break;
						case 'html':
						case 'vue':
							editor?.edit(edit => {
								linesA.forEach((line:any) => {
									edit.insert(new vscode.Position(line.line.line, 0), '\n');
								});
							}).then(() => {
								editor?.edit(edit => {
									linesA.forEach((line:any, idx:number) => {
										edit.insert(new vscode.Position(line.line.line + idx, line.line.character), `${' '.repeat(line.line.character)}<!--\n${' '.repeat(line.line.character)}${line.codeRes.replace('-->', '').split('\n').map((ln:string , idx:number) => {
											if (idx === 0) {
												return ln;
											} 
											return `${' '.repeat(line.line.character)}${ln}`;
										}).join('\n').trim()}\n${' '.repeat(line.line.character)}${vscode.workspace.getConfiguration().get('stenography.generatedBy') ? '- generated by stenography autopilot [ 🚗👩‍✈️ ]\n': ''}${' '.repeat(line.line.character)}-->`);
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
		vscode.window.showInformationMessage(args.stenographyResult.pm, 'Write to File', 'Share').then((value) => {
			const editor = vscode.window.activeTextEditor;
			if (value === 'Write to File') {
				console.log('Write to File');
				
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
