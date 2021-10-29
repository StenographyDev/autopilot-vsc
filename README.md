# stenography README

Leverage the [Stenography Autopilot API](https://bramses.notion.site/bramses/Stenography-Documentation-08e26294e93a48c09ea5bdf3a78ded00#74e2cb7e877840c3a9fa0a3ca53961ab) to automatically comment your code files in VSC.

## Features

1. Input your API Key! (see **Extension Settings** below)
2. On a valid file, hit `ctrl(windows)/cmd(mac) + shift + p` and run `Stenography Autopilot - Dry Run` to see where the AI will comment your code. This won't cost any API invocations.
3. Remove dry run comments by hitting **undo twice (see Known Issues below)**
4. Run Stenography! `ctrl(windows)/cmd(mac) + shift + p` and run `Stenography Autopilot`. This **will** cost API invocations.


\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

This extension contributes the following settings:

* `stenography.apiKey`: **[REQUIRED]** set your [Stenography API key](https://stenography.dev/dashboard)
* `stenography.stackOverflow`: add Stack Overflow search suggestions to your completions

## Known Issues

- Replacing current comments above code blocks. Currently Stenography does not replace/overwrite comments due to edge cases of overwriting code that people wrote manually. It will append the newest version one line above the code block (run dry-run to see where Stenography will comment)
- The empty lines above code blocks. The VSC editor is `thenable` and in order to add explanations correctly, a new line has to be inserted **before** the code block comment is.   


## Release Notes

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.