# stenography README

## [Get the Extension on the VSC Marketplace](https://marketplace.visualstudio.com/items?itemName=Stenography.stenography)

Leverage the [Stenography Autopilot API](https://bramses.notion.site/bramses/Stenography-Documentation-08e26294e93a48c09ea5bdf3a78ded00#74e2cb7e877840c3a9fa0a3ca53961ab) to automatically comment your code files in VSC.

Current language support:
- Javascript
- Typescript
- Python
- HTML

New languages are continously being added! [Follow Stenography on Twitter](https://twitter.com/StenographyDev) to be kept up to date about new languages. 

## Installation

1. Input your API Key: `Cmd + Shift + P` -> `Set Stenography API Key`

![setting api key](install.png)


## Running

1. On a valid file, hit `ctrl(windows)/cmd(mac) + shift + p` and run `Stenography Autopilot - Dry Run` to see where the AI will comment your code. This **won't** cost any API invocations.
2. Remove dry run comments by hitting **undo twice (see Known Issues below)**
3. Run Stenography! `ctrl(windows)/cmd(mac) + shift + p` and run `Stenography Autopilot`. This **will** cost API invocations.
4. To select all comments Stenography generated, use this regex pattern: `(\/\*)(.|\n)+?(\]\s*\n\s*\*\/)`

<img width="839" alt="Screen Shot 2021-11-05 at 11 47 59 AM" src="https://user-images.githubusercontent.com/3282661/140539043-c01c3000-2476-47b7-a929-f9d1b297d23c.png">


![gif of autopilot](autopilot-vsc.gif)

## Requirements

- VSC
- Stenography API Key

## Extension Settings

This extension contributes the following settings:

* `stenography.apiKey`: **[REQUIRED]** set your [Stenography API key](https://stenography.dev/dashboard) in vsc settings (`cmd+,`)
* `stenography.autopilotSettings.zeroCol`: documentation to be inserted on the first column, instead of where the code block starts

## Known Issues

- Replacing current comments above code blocks. Currently Stenography does not replace/overwrite comments due to edge cases of overwriting code that people wrote manually. It will append the newest version one line above the code block (run dry-run to see where Stenography will comment)
- The empty lines above code blocks. The VSC editor is `thenable` and in order to add explanations correctly, a new line has to be inserted **before** the code block comment is.
- Sometimes API key wont save to VSC. Try to paste into box and click on outside of the box or use the command `Set Stenography API Key`


## Release Notes

### 1.0.0

Initial release of Stenography Extension!

### 1.0.1

- Added HTML to list of supported languages
- Added a setting that allows documentation to be inserted on the first column, instead of where the code block starts

### 1.0.2

- Added TSX to list of supported languages
- More information boxes and error boxes

### 1.0.3

- Added `Stenography API Key command`
- Added **[experimental]** code lens mode
- Adjusted comment blocks so that all start lines line up
