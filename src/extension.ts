import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

type TagData = {
	tag: string;
	id: string | null;
	classes: string[] | null;
};

async function createScssFile(editor: vscode.TextEditor, id: string, mainScssFilePath: string, selectedDirectory: string): Promise<void> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('No workspace folder found');
		return;
	}

	const projectRoot = workspaceFolders[0].uri.fsPath;
	let mainScssFileFullPath = path.join(projectRoot, mainScssFilePath);

	while (!fs.existsSync(mainScssFileFullPath)) {
		mainScssFilePath = await vscode.window.showInputBox({
			prompt: 'Enter a valid path for the main SCSS file:',
			value: mainScssFilePath,
		}) as string;

		if (mainScssFilePath === undefined) {
			// User canceled the input
			return;
		}

		mainScssFileFullPath = path.join(projectRoot, mainScssFilePath);
	}

	const mainScssFileDir = path.dirname(mainScssFilePath);

	const targetDirectory = path.join(projectRoot, mainScssFileDir, selectedDirectory);
	const fileName = `_${id.replace(/[#.]/g, '')}.scss`;
	const filePath = path.join(targetDirectory, fileName);

	if (!fs.existsSync(targetDirectory)) {
		fs.mkdirSync(targetDirectory, { recursive: true });
	}

	// if the file already exists, open it
	if (fs.existsSync(filePath)) {
		const document = await vscode.workspace.openTextDocument(filePath);
		vscode.window.showTextDocument(document);
		vscode.window.showInformationMessage(`SCSS file already exists: ${filePath}`);
		return;
	}

	fs.writeFileSync(filePath, cssFileText(id), 'utf8');
	vscode.window.showInformationMessage(`SCSS file created: ${filePath}`);

	// Open and focus on the new SCSS file
	const document = await vscode.workspace.openTextDocument(filePath);
	vscode.window.showTextDocument(document);

	// Link the new SCSS file in the main SCSS file
	const styleScssContent = fs.readFileSync(mainScssFileFullPath, 'utf8');
	const sectionRegex = new RegExp(`//\\s*${selectedDirectory}[^]*?(?=\\/\\/\\s*|$)`, 'i');
	const sectionMatch = styleScssContent.match(sectionRegex);

	if (sectionMatch && sectionMatch.index !== undefined) {
		const sectionContent = sectionMatch[0];
		const updatedSectionContent = sectionContent.trim() + `\n@import "./${selectedDirectory}/${fileName.slice(1).slice(0, -5)}";\n`;

		const updatedStyleScssContent =
			styleScssContent.slice(0, sectionMatch.index) +
			updatedSectionContent +
			styleScssContent.slice(sectionMatch.index + sectionContent.length);

		fs.writeFileSync(mainScssFileFullPath, updatedStyleScssContent, 'utf8');
		vscode.window.showInformationMessage(`SCSS file linked in ${mainScssFilePath}`);
	} else {
		vscode.window.showErrorMessage(`Could not find the ${selectedDirectory} section in ${mainScssFilePath}`);
	}
}


function extractAttributeValue(attributes: string, attributeName: string): string | null {
	const attributeRegex = new RegExp(`${attributeName}\\s*=\\s*['"]([^'"]+)['"]`, 'i');
	const match = attributeRegex.exec(attributes);

	if (match) {
		return match[1];
	}

	return null;
}


function findTagData(document: vscode.TextDocument, position: vscode.Position): TagData | null {
	const fullText = document.getText();
	const tagRegex = /<([a-z0-9]+)([^>]*?)>/gi;
	let match;

	while ((match = tagRegex.exec(fullText)) !== null) {
		const tagRange = new vscode.Range(
			document.positionAt(match.index),
			document.positionAt(tagRegex.lastIndex)
		);

		if (tagRange.contains(position)) {
			const id = extractAttributeValue(match[2], 'id');
			const classes = extractAttributeValue(match[2], 'class')?.split(/\s+/) || [];

			return {
				tag: match[1],
				id,
				classes
			};
		}
	}

	return null;
}


async function getSelectedDirectory(projectRoot: string, mainScssFilePath: string): Promise<string | undefined> {
	const directories = await getDirectoriesFromStyleScss(projectRoot, mainScssFilePath);
	const selectedDirectory = await vscode.window.showQuickPick(directories, {
		placeHolder: 'Choose a directory for the new SCSS file',
	});

	return selectedDirectory;
}

async function getDirectoriesFromStyleScss(projectRoot: string, mainScssFilePath: string): Promise<string[]> {
	const styleScssPath = path.join(projectRoot, mainScssFilePath);
	const styleScssContent = fs.readFileSync(styleScssPath, 'utf8');
	const sectionRegex = /^\/\/\s*([a-zA-Z]+)\s*$/gm;
	const directories: string[] = [];

	let match;
	while ((match = sectionRegex.exec(styleScssContent)) !== null) {

		const directory = match[1];

		// if it exists, format to lowercase
		if (directory) {
			directories.push(directory.toLowerCase());
		}
	}

	return directories;
}

function cssFileText(tagData: string): string {
	return `${tagData} {\n\n}`;
}

async function setMainScssFile(uri: vscode.Uri): Promise<void> {
	const mainScssFilePath = vscode.workspace.asRelativePath(uri);

	const configuration = vscode.workspace.getConfiguration('create-scss-file');
	await configuration.update('mainScssFilePath', mainScssFilePath, vscode.ConfigurationTarget.Workspace);

	vscode.window.showInformationMessage(`Main SCSS file set to: ${mainScssFilePath}`);
}

export async function activate(context: vscode.ExtensionContext) {

	const config = vscode.workspace.getConfiguration('create-scss-file');
	let mainScssFilePath = config.get<string>('mainScssFilePath');

	if (!mainScssFilePath) {
		const mainScssFileUri = await vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: 'Select Main SCSS File',
			filters: { 'SCSS Files': ['scss'] },
		});

		if (mainScssFileUri && mainScssFileUri[0]) {
			mainScssFilePath = vscode.workspace.asRelativePath(mainScssFileUri[0], true);
			await config.update('mainScssFilePath', mainScssFilePath, vscode.ConfigurationTarget.Workspace);
		} else {
			vscode.window.showErrorMessage('No main SCSS file selected');
			return;
		}
	}

	const disposable = vscode.commands.registerCommand('extension.createScssFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		const position = editor.selection.active;
		const tagData = findTagData(editor.document, position);

		if (tagData) {


			const chosenOption = await vscode.window.showQuickPick(
				[
					...(tagData.id ? [`#${tagData.id}`] : []),
					...(tagData.classes ? tagData.classes.map((className) => `.${className}`) : []),
					...(tagData.tag ? [`${tagData.tag}`] : []),
				],
				{
					placeHolder: 'Choose an attribute to base the SCSS file on',
				}
			);;

			if (!chosenOption) {
				// vscode.window.showErrorMessage('No identifier selected');
				return;
			}

			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}

			const projectRoot = workspaceFolders[0].uri.fsPath;
			const config = vscode.workspace.getConfiguration('create-scss-file');
			const mainScssFilePath = config.get<string>('mainScssFilePath') || 'src/assets/scss/style.scss';

			const selectedDirectory = await getSelectedDirectory(projectRoot, mainScssFilePath);

			if (!selectedDirectory) {
				// vscode.window.showErrorMessage('No directory selected');
				return;
			}

			await createScssFile(editor, chosenOption, mainScssFilePath, selectedDirectory);;
		} else {
			vscode.window.showErrorMessage('No matching HTML tag found');
		}
	});

	const setMainScssFileDisposable = vscode.commands.registerCommand(
		'extension.setMainScssFile',
		async (uri: vscode.Uri) => {
			await setMainScssFile(uri);
		}
	);

	context.subscriptions.push(setMainScssFileDisposable);

	context.subscriptions.push(disposable);
}

export function deactivate() { }
