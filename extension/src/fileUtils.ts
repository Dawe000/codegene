import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Information about a file in the workspace
 */
export interface FileInfo {
    /** Full URI of the file */
    uri: vscode.Uri;
    /** File name with extension */
    fileName: string;
    /** Programming language of the file (solidity or rust) */
    language: 'solidity' | 'rust';
    /** Full file path */
    filePath: string;
}

/**
 * Finds all Solidity and Rust files in the workspace
 * @returns Promise<FileInfo[]> Array of file information objects
 */
export async function findSolAndRustFiles(): Promise<FileInfo[]> {
    try {
        const solFiles = await vscode.workspace.findFiles('**/*.sol', '**/node_modules/**');
        const rustFiles = await vscode.workspace.findFiles('**/*.rs', '**/target/**');
        
        const fileInfos: FileInfo[] = [];
        
        // Process Solidity files
        for (const uri of solFiles) {
            fileInfos.push({
                uri,
                fileName: path.basename(uri.fsPath),
                language: 'solidity',
                filePath: uri.fsPath
            });
        }
        
        // Process Rust files
        for (const uri of rustFiles) {
            fileInfos.push({
                uri,
                fileName: path.basename(uri.fsPath),
                language: 'rust',
                filePath: uri.fsPath
            });
        }
        
        console.log(`[findSolAndRustFiles] Found ${solFiles.length} Solidity files and ${rustFiles.length} Rust files`);
        return fileInfos;
    } catch (error) {
        console.error('Error finding Solidity and Rust files:', error);
        return [];
    }
}

/**
 * Checks if the current workspace is a Hardhat project
 * @returns Promise<boolean> True if a Hardhat project is detected
 */
export async function isHardhatProject(): Promise<boolean> {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return false;
        }
        
        // Check for hardhat.config.js or hardhat.config.ts
        const hardhatJsConfig = await vscode.workspace.findFiles('**/hardhat.config.js', '**/node_modules/**', 1);
        const hardhatTsConfig = await vscode.workspace.findFiles('**/hardhat.config.ts', '**/node_modules/**', 1);
        
        return hardhatJsConfig.length > 0 || hardhatTsConfig.length > 0;
    } catch (error) {
        console.error('Error checking for Hardhat project:', error);
        return false;
    }
}

/**
 * Gets all Solidity contract files in a Hardhat project
 * @returns Promise<Array<{name: string, path: string}>> Array of contract file info
 */
export async function findHardhatContracts(): Promise<{name: string, path: string}[]> {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }
        
        // Find all .sol files in the contracts directory
        const contractFiles = await vscode.workspace.findFiles('**/contracts/**/*.sol', '**/node_modules/**');
        
        return contractFiles.map(uri => ({
            name: path.basename(uri.fsPath),
            path: uri.fsPath
        }));
    } catch (error) {
        console.error('Error finding Hardhat contracts:', error);
        return [];
    }
}

/**
 * Reads the content of a contract file
 * @param filePath Path to the contract file
 * @returns Promise<string> Content of the file
 */
export async function readContractFile(filePath: string): Promise<string> {
    try {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        return document.getText();
    } catch (error) {
        console.error(`Error reading contract file ${filePath}:`, error);
        throw error;
    }
}

/**
 * Gets the current workspace path
 * @returns string | undefined The workspace path or undefined if no workspace is open
 */
export function getWorkspacePath(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0].uri.fsPath;
}

/**
 * Creates the test directory if it doesn't exist
 * @returns Promise<string> Path to the test directory
 */
export async function ensureTestDirectory(): Promise<string> {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        throw new Error('No workspace folder is open');
    }
    
    const testDir = path.join(workspacePath, 'test');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    
    return testDir;
}

/**
 * Reads contract contents from multiple files and combines them
 * @param contractPaths Array of paths to contract files
 * @returns Promise<string> Combined contract code
 */
export async function readAndCombineContracts(contractPaths: string[]): Promise<string> {
    try {
        if (contractPaths.length === 0) {
            throw new Error('No contract paths provided');
        }
        
        // Read all file contents
        const fileContents: string[] = [];
        for (const filePath of contractPaths) {
            const content = await readContractFile(filePath);
            fileContents.push(`// FILE: ${path.basename(filePath)}\n${content}`);
        }
        
        // Combine file contents with clear separation
        return fileContents.join('\n\n// ==========================================\n\n');
    } catch (error) {
        console.error('Error reading and combining contracts:', error);
        throw error;
    }
}