import * as vscode from 'vscode';
import * as path from 'path';

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