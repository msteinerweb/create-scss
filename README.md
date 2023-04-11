# Create SCSS File Extension for Visual Studio Code

A simple extension to create an SCSS file associated with an HTML tag's ID, class, or tag name.

## Features

- Automatically create an SCSS file based on the selected HTML tag's ID, class, or tag name.
- Add an import statement to the main SCSS file for the newly created file.
- Open and focus on the newly created SCSS file.

## How to Use

1. Install the extension in Visual Studio Code.
2. Right-click on an HTML tag with an ID, class, or tag name attribute in your code.
3. Select "Create SCSS File" from the context menu.
4. Choose the attribute to base the SCSS file on (ID, class, or tag name).
5. Select the directory to create the new SCSS file in.

## Configuration

You can configure the path to the main SCSS file through the extension settings. By default, it's set to `src/assets/scss/style.scss`. Change this to match your project's structure if needed.

```json
"create-scss-file.mainScssFilePath": "path/to/your/main/scss/file.scss"
```

## Release Notes
0.0.2
Initial release of Create SCSS File extension.
