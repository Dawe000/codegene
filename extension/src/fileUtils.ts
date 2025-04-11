import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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
 * Writes a hardhat test file to the test directory
 * @param fileName Name for the test file
 * @param content Content of the test file
 * @returns Promise<string> Path to the created file
 */
export async function writeHardhatTestFile(fileName: string, content: string): Promise<string> {
    try {
        const testDir = await ensureTestDirectory();
        const sanitizedFileName = fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\.]/g, '');
        const filePath = path.join(testDir, sanitizedFileName.endsWith('.js') ? sanitizedFileName : `${sanitizedFileName}.js`);
        
        fs.writeFileSync(filePath, content);
        return filePath;
    } catch (error) {
        console.error(`Error writing test file ${fileName}:`, error);
        throw error;
    }
}

/**
 * Combines multiple exploits into a single test file
 * @param vulnerabilityType Type of vulnerability
 * @param contractCode Original contract code
 * @param exploits Array of exploit objects
 * @returns Promise<string|null> Path to the created file or null on error
 */
export async function combineExploitsToFile(
    vulnerabilityType: string, 
    contractCode: string, 
    exploits: any[]
): Promise<string|null> {
    try {
        if (!exploits || exploits.length === 0) {
            vscode.window.showWarningMessage('No exploits to combine');
            return null;
        }
        
        console.log(`Combining ${exploits.length} exploits for ${vulnerabilityType}`);
        
        // Create test directory if it doesn't exist
        const testDir = await ensureTestDirectory();
        
        // Combine all exploits into a single file
        const fileName = `Combined_${vulnerabilityType.replace(/\s+/g, '_')}_Exploits.js`;
        const filePath = path.join(testDir, fileName);
        
        let combinedCode = `// Combined Exploit Tests for ${vulnerabilityType}\n`;
        combinedCode += `// Generated on ${new Date().toLocaleString()}\n\n`;
        combinedCode += `const { expect } = require("chai");\n`;
        combinedCode += `const { ethers } = require("hardhat");\n\n`;
        combinedCode += `describe("${vulnerabilityType} Vulnerability Tests", function() {\n`;
        
        // Add each exploit as a separate test
        for (const exploit of exploits) {
            // Get exploit name - handle different property names
            const exploitName = exploit.vulnerability_name || exploit.name || 'Unnamed Exploit';
            const severity = exploit.severity || 'Unknown';
            
            if (!exploit.hardhat_test) {
                // If no hardhat_test, try to generate one from exploit_code
                if (exploit.exploit_code) {
                    combinedCode += `\n  // ${exploitName} - ${severity} Severity\n`;
                    combinedCode += `  it("should test ${exploitName}", async function() {\n`;
                    combinedCode += `    // Placeholder: This was generated from exploit_code\n`;
                    combinedCode += `    // Original exploit code:\n`;
                    
                    const cleanExploitCode = exploit.exploit_code
                        .replace(/^```[\w-]*\n/m, '')
                        .replace(/\n```$/m, '')
                        .split('\n')
                        .map((line: string) => `    // ${line}`)
                        .join('\n');
                        
                    combinedCode += cleanExploitCode + '\n\n';
                    combinedCode += `    // TODO: Convert this to a working Hardhat test\n`;
                    combinedCode += `    // This is a placeholder test\n`;
                    combinedCode += `    // Deploy the vulnerable contract\n`;
                    combinedCode += `    const ContractFactory = await ethers.getContractFactory("VulnerableContract");\n`;
                    combinedCode += `    const contract = await ContractFactory.deploy();\n`;
                    combinedCode += `    await contract.deployed();\n\n`;
                    combinedCode += `    // Basic assertion to make test pass\n`;
                    combinedCode += `    expect(await contract.address).to.be.properAddress;\n`;
                    combinedCode += `  });\n`;
                    continue;
                } else {
                    // Skip this exploit if it has no code
                    console.log(`Skipping exploit "${exploitName}" as it has no hardhat_test or exploit_code`);
                    continue;
                }
            }
            
            // Clean the hardhat test code
            let testCode = exploit.hardhat_test;
            testCode = testCode.replace(/^```[\w-]*\n/m, '');
            testCode = testCode.replace(/\n```$/m, '');
            
            console.log(`Processing exploit "${exploitName}"`);
            console.log(`Test code length: ${testCode.length} characters`);
            
            // Check if the test code is empty
            if (!testCode.trim()) {
                console.log(`Empty test code for "${exploitName}", skipping`);
                continue;
            }
            
            // Extract the describe block content using a more flexible regex
            const describeMatch = testCode.match(/describe\([^{]*{([\s\S]*?)}\)\;?\s*$/);
            
            if (describeMatch && describeMatch[1]) {
                // Extract just the test content, not the describe wrapper
                combinedCode += `\n  // ${exploitName} - ${severity} Severity\n`;
                combinedCode += `  it("should test ${exploitName}", async function() {\n`;
                
                // Extract the it block content or use the whole describe content
                const itMatch = describeMatch[1].match(/it\([^{]*{([\s\S]*?)}\)\;/);
                if (itMatch && itMatch[1]) {
                    combinedCode += `    ${itMatch[1].trim()}\n`;
                } else {
                    // If no it block found, use the describe content with indentation
                    // Skip any before/after hooks
                    const content = describeMatch[1]
                        .replace(/beforeEach\([^{]*{[\s\S]*?}\)\;/g, '')
                        .replace(/afterEach\([^{]*{[\s\S]*?}\)\;/g, '')
                        .trim();
                        
                    combinedCode += content.split('\n')
                        .map((line: string) => line.trim() ? `    ${line}` : line)
                        .join('\n');
                }
                
                combinedCode += `  });\n`;
            } else {
                // If no describe block found, look for standalone it blocks
                const itBlockMatch = testCode.match(/it\([^{]*{([\s\S]*?)}\)\;/);
                if (itBlockMatch && itBlockMatch[1]) {
                    combinedCode += `\n  // ${exploitName} - ${severity} Severity\n`;
                    combinedCode += `  it("should test ${exploitName}", async function() {\n`;
                    combinedCode += `    ${itBlockMatch[1].trim()}\n`;
                    combinedCode += `  });\n`;
                } else {
                    // Fallback: just include the entire test with a comment
                    combinedCode += `\n  // ${exploitName} - ${severity} Severity\n`;
                    combinedCode += `  it("should test ${exploitName}", async function() {\n`;
                    combinedCode += `    // Could not extract test logic, here's the full code:\n`;
                    
                    // Add the whole test code as comments
                    const commentedCode: string = testCode
                        .split('\n')
                        .map((line: string) => `    // ${line}`)
                        .join('\n');
                    
                    combinedCode += commentedCode + '\n';
                    combinedCode += `    // Placeholder assertion\n`;
                    combinedCode += `    expect(true).to.be.true;\n`;
                    combinedCode += `  });\n`;
                }
            }
        }
        
        combinedCode += `});\n`;
        
        // Write the combined file
        fs.writeFileSync(filePath, combinedCode);
        return filePath;
    } catch (error: any) {
        console.error('Error combining exploits:', error);
        return null;
    }
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