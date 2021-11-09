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

interface StenographyResponse {
	pm: string,
	code: string,
	metadata: any
}

interface CodeBlock {
	stenographyResult: StenographyResponse,
	startPosition: any,
	endPosition: any
}

interface AutopilotResponse {
	invocation_counter: number,
	code_blocks?: [CodeBlock]
	error?: any
}

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
		return json;
	} catch (err: any) {
		console.error(err);
        return { error: err, invocation_counter: -1 };
	}
};