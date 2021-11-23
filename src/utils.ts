import fetch from 'node-fetch';
/* eslint-disable @typescript-eslint/naming-convention */

export const FILETYPES:any = {
	"ts": "typescript",
	"tsx": "tsx",
	"js": "javascript",
	"py": "python",
	"html": "html",
    "rb": "ruby",
};

export const CACHE_NAME = "stenographyCache";

export interface StenographyResponse {
	pm: string,
	code: string,
	metadata: any,
	error?: string,
}

interface CodeBlock {
	stenographyResult: StenographyResponse,
	startPosition: any,
	endPosition: any
}

export interface AutopilotResponse {
	invocation_counter: number,
	code_blocks?: [CodeBlock]
	error?: any
}

interface DocumentCache {
	[key: string]: any | null
}

interface CodeLensCache {
	[key: string]: {
		boundTo: string,
		command?: {
			title: string;
			tooltip: any;
			command: string;
			arguments: any[];
		}
	}[] | null
}

export interface CacheObject {
	documentCache: DocumentCache,
	codeLensCache: CodeLensCache,
	maxedOutInvocations: boolean,
	lastChecked: Date,
	isProcessing: boolean
}

export const getFileType = (fileName: string) => {
	const fullFileName: string[] | undefined = fileName.split('.');
	const fileType: string | undefined = fullFileName.slice(-1)[0];
	return FILETYPES[fileType];
};

export const fetchStenographyAutopilot = async (api_key: string, code: string, language: string, dryRun: boolean = true): Promise<AutopilotResponse> => {

    console.log(`Fetching stenography autopilot for ${language}`);

	let fetchUrl = 'https://stenography-worker.stenography.workers.dev/autopilot';

	let options = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ 
			"code": code, 
			"api_key": api_key.trim(), 
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
		console.log(`Autopilot response: ${JSON.stringify(json, null, 2)}`);
		return json;
	} catch (err: any) {
		console.error(err);
        return { error: err, invocation_counter: -1 };
	}
};

export const fetchStenography = async (api_key: string, code: string, language: string): Promise<StenographyResponse> => {

    console.log(`Fetching stenography for ${language}`);

	let fetchUrl = 'https://stenography-worker.stenography.workers.dev/';

	let options = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ 
			"code": code, 
			"api_key": api_key.trim(), 
			"language": language, 
			"audience": "pm",
			"stackoverflow": false,
			"populate": false
		})
	};

	try {
		const resp = await fetch(fetchUrl, options);

		const json: any = await resp.json();
		if (typeof json === 'string') {
			throw new Error(json);
		}
		console.log(`Stenography response: ${JSON.stringify(json)}`);
		return json;
	} catch (err: any) {
		console.error(err);
        return { error: err, pm: '', code: '', metadata: {} };
	}
};

export function escapeRegExp(text: string) {
    if (text) {
		return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
	}
	return text;
}