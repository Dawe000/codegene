import * as vscode from 'vscode';
import * as path from 'path';
import { findSolAndRustFiles, FileInfo } from './fileUtils';

/**
 * Returns just the filenames of all Solidity (.sol) and Rust (.rs) files in the workspace
 * @returns Promise<string[]> Array of filenames
 */
export async function getSolAndRustFileNames(): Promise<string[]> {
  try {
    // Use the existing function to get file information
    const fileInfos: FileInfo[] = await findSolAndRustFiles();
    
    // Extract just the filenames
    const fileNames: string[] = fileInfos.map(fileInfo => fileInfo.fileName);
    
    console.log(`[getSolAndRustFileNames] Found ${fileNames.length} .sol and .rs files`);
    return fileNames;
  } catch (error) {
    console.error('Error getting file names:', error);
    return [];
  }
}

/**
 * Returns the filenames grouped by language type
 * @returns Promise<{solidity: string[], rust: string[]}>
 */
export async function getGroupedFileNames(): Promise<{solidity: string[], rust: string[]}> {
  try {
    const fileInfos: FileInfo[] = await findSolAndRustFiles();
    
    const result = {
      solidity: fileInfos
        .filter(file => file.language === 'solidity')
        .map(file => file.fileName),
      rust: fileInfos
        .filter(file => file.language === 'rust')
        .map(file => file.fileName)
    };
    
    console.log(`[getGroupedFileNames] Found ${result.solidity.length} Solidity files and ${result.rust.length} Rust files`);
    return result;
  } catch (error) {
    console.error('Error getting grouped file names:', error);
    return { solidity: [], rust: [] };
  }
}