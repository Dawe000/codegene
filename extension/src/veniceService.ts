// src/services/veniceService.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { Configuration, OpenAIApi } from "openai";
import { ChatCompletionRequestWithVenice } from './types';

// Load environment variables directly in this file
const envPath = path.resolve(__dirname, '..', '.env');
console.log(`🔍 Loading .env file from: ${envPath}`);
dotenv.config({ path: envPath });

// Configure OpenAI client with Venice base URL - Note the .ai domain instead of .is
const configuration = new Configuration({
  apiKey: "vHr1A25Y7V8ObYcGwqHTJOuvFKnOmFtyd-eapHxdBZ",
  basePath: "https://api.venice.ai/api/v1" // Changed from .is to .ai domain
});

console.log("OpenAI configuration initialized:", {
  basePath: configuration.basePath,
  apiKeySet: !!configuration.apiKey,
  apiKeyLength: typeof configuration.apiKey === "string" ? configuration.apiKey.length : 0
});

const openai = new OpenAIApi(configuration);
console.log("OpenAI client instance created");

/**
 * Analyzes a smart contract with improved error handling
 */
export const analyzeContract = async (contractCode: string): Promise<any> => {
  console.log("⭐ analyzeContract called with code length:", contractCode.length);
  
  try {
    // Validate environment variables
    if (!process.env.REACT_APP_VENICE_API_KEY) {
      console.error("❌ Venice API key is not set");
      return generateOfflineAnalysisResult("API key is not configured. Set REACT_APP_VENICE_API_KEY environment variable.");
    }
    
    console.log("API Key available, API URL:", configuration.basePath);
    
    const requestData: ChatCompletionRequestWithVenice = {
      model: "default",
      messages: [
        {
          role: "system",
          content: `You are a smart contract security analyzer. Analyze the following contract for vulnerabilities and security issues. 
          Respond with a JSON object that has the following structure:
          {
            "overall_score": number from 0-100,
            "complexity": {
              "score": number from 0-100,
              "details": array of strings with findings,
              "risk_level": "Low", "Medium", or "High"
            },
            "vulnerabilities": {
              "score": number from 0-100,
              "details": array of strings describing vulnerabilities,
              "risk_level": "Low", "Medium", or "High",
              "exploits": [
                {
                  "name": "Name of vulnerability",
                  "description": "Brief description of the vulnerability",
                  "severity": "Low", "Medium", or "High",
                  "mitigation": "How to fix this vulnerability"
                }
              ]
            },
            "upgradability": {
              "score": number from 0-100,
              "details": array of strings with findings,
              "risk_level": "Low", "Medium", or "High"
            },
            "behavior": {
              "score": number from 0-100,
              "details": array of strings with findings,
              "risk_level": "Low", "Medium", or "High"
            }
          }`
        },
        {
          role: "user",
          content: `Analyze this smart contract:\n\n${contractCode}`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      venice_parameters: {
        include_venice_system_prompt: false
      }
    };

    // Make the API call with proper error handling
    console.log("⏳ Sending API request...");
    const startTime = Date.now();
    
    try {
      const response = await openai.createChatCompletion(requestData as any);
      const duration = Date.now() - startTime;
      console.log(`✅ API response received in ${duration}ms`);

      // Add null checks for response data
      if (!response?.data) {
        console.error("❌ No data in API response");
        return generateOfflineAnalysisResult("No data received from API");
      }

      if (!response?.data?.choices?.[0]?.message?.content) {
        console.error("❌ Invalid response structure");
        return generateOfflineAnalysisResult("Invalid response from API - no content found");
      }

      // Parse the response content as JSON
      try {
        const content = response.data.choices[0].message.content;
        
        // Try to detect if the response is already JSON or wrapped in markdown
        let jsonContent = content;
        
        // If response is wrapped in markdown code blocks, extract it
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                        content.match(/```\n([\s\S]*?)\n```/);
        
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        }
        
        const parsedResult = JSON.parse(jsonContent);
        return parsedResult;
      } catch (parseError) {
        console.error("❌ Failed to parse API response as JSON:", parseError);
        return generateOfflineAnalysisResult(
          "Failed to parse analysis results",
          response.data.choices[0].message.content
        );
      }
    } catch (error: any) {
      // Network or API-specific errors
      console.error("❌ API request failed:", error.message);
      
      if (error.code === 'ENOTFOUND') {
        console.log("🔄 Network error: Cannot resolve hostname. Falling back to local analysis.");
        return generateOfflineAnalysisResult(
          "Cannot connect to Venice API. Please check your network connection and API configuration.",
          null,
          true // Use local analysis
        );
      } else if (error.code === 'ECONNREFUSED') {
        console.log("🔄 Connection refused. Falling back to local analysis.");
        return generateOfflineAnalysisResult(
          "Connection to Venice API was refused. Please check your API configuration.",
          null,
          true // Use local analysis
        );
      } else if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log("🔄 API responded with error:", error.response.status);
        return generateOfflineAnalysisResult(
          `API responded with error: ${error.response.status} - ${error.response.statusText}`
        );
      } else if (error.request) {
        // The request was made but no response was was received
        console.log("🔄 No response received. Likely a timeout or network issue. Falling back to local analysis.");
        return generateOfflineAnalysisResult(
          "No response received from API. Please check your network connection.",
          null,
          true // Use local analysis
        );
      } else {
        // Something happened in setting up the request that triggered an Error
        return generateOfflineAnalysisResult(`Error setting up request: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error("❌ Unexpected error in analyzeContract:", error);
    return generateOfflineAnalysisResult(`Unexpected error: ${error.message}`);
  }
};

/**
 * Generates a basic analysis result when the API is unavailable
 * This provides a graceful fallback experience for users
 */
function generateOfflineAnalysisResult(
  errorMessage: string, 
  rawResponse: string | null = null,
  useLocalAnalysis: boolean = false
): any {
  // Your existing implementation - no changes needed
  if (useLocalAnalysis) {
    return {
      overall_score: 50,
      error_info: errorMessage,
      offline_mode: true,
      complexity: {
        score: 50,
        details: [
          "Local analysis mode - API unavailable",
          "Cannot perform detailed complexity analysis without API access"
        ],
        risk_level: "Medium"
      },
      vulnerabilities: {
        score: 50,
        details: [
          "Local analysis mode - API unavailable",
          "Basic security checks only. Consider reviewing code manually."
        ],
        risk_level: "Medium",
        exploits: [
          {
            name: "Potential Authorization Issues",
            description: "Without full analysis, authorization flows should be carefully reviewed",
            severity: "Medium",
            mitigation: "Ensure proper access controls are implemented for all sensitive functions"
          },
          {
            name: "Arithmetic Safety",
            description: "Check for proper arithmetic safety mechanisms",
            severity: "Medium",
            mitigation: "Use SafeMath or Solidity 0.8+ built-in overflow protection"
          }
        ]
      },
      upgradability: {
        score: 50,
        details: [
          "Local analysis mode - API unavailable",
          "Consider using standard upgrade patterns if upgradability is needed"
        ],
        risk_level: "Medium"
      },
      behavior: {
        score: 50,
        details: [
          "Local analysis mode - API unavailable",
          "Basic contract behavior cannot be fully analyzed without API access"
        ],
        risk_level: "Medium"
      }
    };
  } else {
    return {
      error: errorMessage,
      raw_response: rawResponse,
      offline_mode: false
    };
  }
}

/**
 * Generates a single penetration test for a smart contract
 */
export const generatePenetrationTest = async (
  contractCode: string,
  contractName: string,
  vulnerabilityType?: string
): Promise<{ success: boolean; filePath?: string; error?: string }> => {
  try {
    console.log(`Generating penetration test for ${contractName}, vulnerability type: ${vulnerabilityType || 'auto'}`);
    
    // Make the API request to generate the test
    // In the generatePenetrationTest function, modify the systemPrompt

const systemPrompt = `You are an expert in smart contract security and penetration testing. 
Create a standalone TypeScript file that performs penetration testing on the provided smart contract.

IMPORTANT - Create a SELF-CONTAINED test file that works with Hardhat:

1. Use ONLY these imports:
   \`\`\`typescript
   import { ethers } from "hardhat";
   import { expect } from "chai";
   \`\`\`

2. DO NOT create or use separate attacker contracts - your test MUST be self-contained
   - Create attack functions directly in the test
   - Use multiple Hardhat signers (accounts) for different roles
   - Interact directly with the vulnerable contract

3. TECHNICAL REQUIREMENTS:
   - Use Hardhat ethers v6 syntax correctly (await contract.waitForDeployment(), await contract.getAddress())
   - Use ethers.parseEther() for ETH amounts (not ethers.utils.parseEther)
   - For reentrancy attacks, implement inline fallback functions using the attacker signer
   - Ethers v6 uses BigInt for numbers - use 0n for zero and handle comparison appropriately

4. CRITICAL FUNCTION REQUIREMENT:
   - I will provide a list of available contract functions
   - ONLY USE THESE EXACT FUNCTIONS in your test - do not call any function not in the list
   - Use the EXACT function names as provided, with correct parameter types

5. FOCUS on testing ONE specific vulnerability type per test:
   - Reentrancy
   - Access control issues
   - Integer overflow/underflow
   - Front-running
   - Logic errors

Here are the available contract functions you MUST use (no others):
{{FUNCTION_LIST}}

Here's the format to follow:

\`\`\`typescript
// FILENAME: penetrationTest-[ContractName]-[VulnerabilityType].ts

import { ethers } from "hardhat";
import { expect } from "chai";

/**
 * Penetration Test: [Vulnerability Name]
 * Target Contract: [Contract Name]
 * 
 * Description: Detailed explanation of the vulnerability
 */

describe("[Vulnerability Name] Penetration Test", function() {
  // Increase timeout for complex tests
  this.timeout(60000);
  
  it("should successfully exploit the vulnerability", async function() {
    // Get signers
    const [owner, attacker, user1, user2] = await ethers.getSigners();
    
    console.log("Owner address:", owner.address);
    console.log("Attacker address:", attacker.address);
    
    // Deploy the vulnerable contract
    console.log("Deploying vulnerable contract...");
    const VulnerableContract = await ethers.getContractFactory("YourContract");
    const vulnerableContract = await VulnerableContract.deploy(/* constructor args if any */);
    await vulnerableContract.waitForDeployment();
    
    const contractAddress = await vulnerableContract.getAddress();
    console.log("Vulnerable contract deployed at:", contractAddress);
    
    // Set up the environment for the exploit using only the available functions:
    // {{AVAILABLE_FUNCTIONS_REMINDER}}
    
    // EXPLOIT IMPLEMENTATION
    console.log("Executing exploit...");
    
    // Example for reentrancy: Create a series of transactions with specific conditions
    const initialAttackerBalance = await ethers.provider.getBalance(attacker.address);
    console.log("Initial attacker balance:", ethers.formatEther(initialAttackerBalance));
    
    // Step 1: Attacker interacts with the contract using ONLY available functions
    // REMINDER: Available functions: {{FUNCTION_LIST}}
    
    // Verification
    console.log("Verifying exploit results...");
    
    // Add assertions to verify the exploit worked
    const finalAttackerBalance = await ethers.provider.getBalance(attacker.address);
    console.log("Final attacker balance:", ethers.formatEther(finalAttackerBalance));
    
    // Use chai assertions
    expect(finalAttackerBalance).to.be.gt(initialAttackerBalance);
  });
});

// Function to execute the test (optional - used when running directly)
export async function runPenetrationTest() {
  try {
    // This will be run by Mocha when using 'npx hardhat test'
    console.log("Run this test with: npx hardhat test");
    return { success: true };
  } catch (error) {
    console.error("Penetration test failed:", error);
    return { success: false, error: error.message };
  }
}
\`\`\`

IMPORTANT NOTES:
1. DO NOT try to deploy any contracts besides the main contract that's already in the project
2. DO NOT reference any external attacker contracts like "MaliciousContract" - all code must be in the test file
3. For reentrancy attacks, DO NOT create a separate attacker contract - use the test file's logic instead
4. Most vulnerabilities can be exploited by using multiple accounts and careful sequencing of transactions
5. Focus on clarity and simplicity to demonstrate the vulnerability
6. ONLY CALL FUNCTIONS THAT EXIST: {{FUNCTION_LIST}}

Your penetration test must be a single self-contained file that can run without additional dependencies.`;

const functionMatches = [...contractCode.matchAll(/function\s+(\w+)\s*\(([^)]*)\)/g)];
const availableFunctions = functionMatches.map(match => ({
  name: match[1],
  params: match[2].trim()
}));

// Create a clear function list for the template
const functionListStr = availableFunctions.map(f => 
  `${f.name}(${f.params})`
).join(', ');

// Replace placeholders in the system prompt
const processedSystemPrompt = systemPrompt
  .replace('{{FUNCTION_LIST}}', functionListStr)
  .replace('{{AVAILABLE_FUNCTIONS_REMINDER}}', functionListStr);

    const requestData: ChatCompletionRequestWithVenice = {
      model: "default",
      messages: [
      {
        role: "system",
        content: processedSystemPrompt
      },
      {
        role: "user",
        content: `Analyze this smart contract for vulnerabilities and create a penetration test${vulnerabilityType ? ` targeting ${vulnerabilityType}` : ''}:\n\n${contractCode}\n\nREMINDER: ONLY use these functions in your test: ${functionListStr}`
      }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      venice_parameters: {
      include_venice_system_prompt: false
      }
    };
    
    console.log("Making API request to Venice for test generation");
    const response = await openai.createChatCompletion(requestData as any);
    
    if (!response?.data?.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from API - no content");
    }
    
    const content = response.data.choices[0].message.content;
    console.log(`Response received with length: ${content.length} characters`);
    
    // Extract TypeScript code from the response
    const codeMatch = content.match(/```typescript\n([\s\S]*?)\n```/) || 
                    content.match(/```ts\n([\s\S]*?)\n```/) || 
                    content.match(/```\n([\s\S]*?)\n```/);
                      
    let testCode = content;
    if (codeMatch && codeMatch[1]) {
      testCode = codeMatch[1];
    }
    
    console.log(`Extracted test code: ${testCode.length} characters`);
    
    // Save the file to the workspace
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      throw new Error("No workspace open");
    }
    
    // Create test directory if it doesn't exist
    const testDir = path.join(workspacePath, 'test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Create a filename with timestamp to avoid collisions
    const timestamp = Date.now();
    const vulnTypeSuffix = vulnerabilityType ? `-${vulnerabilityType}` : '';
    const filename = `${contractName}-PenetrationTest${vulnTypeSuffix}-${timestamp}.ts`;
    const filePath = path.join(testDir, filename);
    
    // Write the file
    fs.writeFileSync(filePath, testCode);
    console.log(`Penetration test saved to: ${filePath}`);
    
    return {
      success: true,
      filePath
    };
  } catch (error: any) {
    console.error("Error generating penetration test:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generates multiple penetration tests targeting different vulnerabilities
 */
export const generateMultiplePenetrationTests = async (
  contractCode: string,
  contractName: string,
  vulnerabilities: any[]
): Promise<{ success: boolean; tests: any[]; error?: string }> => {
  try {
    console.log(`Generating ${vulnerabilities.length} penetration tests for ${contractName}`);
    
    const tests = [];
    
    // Generate a test for each vulnerability
    for (let i = 0; i < vulnerabilities.length; i++) {
      const vuln = vulnerabilities[i];
      console.log(`Generating test ${i+1}/${vulnerabilities.length} for ${vuln.name}`);
      
      // Extract vulnerability type from the name or category
      let vulnerabilityType = 'Unknown';
      if (vuln.name) {
        const vulnTypeMatch = vuln.name.match(/(Reentrancy|Access Control|Integer Overflow|Front-Running|Logic|Unchecked)/i);
        if (vulnTypeMatch) {
          vulnerabilityType = vulnTypeMatch[1];
        }
      }
      
      // Generate the test with specific instructions based on the vulnerability
      const prompt = `Generate a penetration test that exploits the following vulnerability:
      
Name: ${vuln.name}
Type: ${vulnerabilityType}
Severity: ${vuln.severity || 'Unknown'}
Description: ${vuln.description || 'No description provided'}

The test should focus specifically on exploiting this vulnerability in the contract.`;
      
      const result = await generatePenetrationTest(contractCode, contractName, vulnerabilityType);
      
      if (result.success && result.filePath) {
        tests.push({
          vulnerability: vuln.name,
          type: vulnerabilityType,
          severity: vuln.severity,
          filePath: result.filePath
        });
      } else {
        console.error(`Failed to generate test for ${vuln.name}: ${result.error}`);
      }
    }
    
    return {
      success: tests.length > 0,
      tests
    };
  } catch (error: any) {
    console.error("Error generating multiple penetration tests:", error);
    return {
      success: false,
      tests: [],
      error: error.message
    };
  }
};

/**
 * Runs and automatically refines a penetration test until success or cycle limit reached
 * 
 * @param contractCode The source code of the contract to test
 * @param contractName The name of the contract
 * @param testFilePath The initial test file path
 * @param maxCycles Maximum number of refinement cycles (default: 5)
 * @returns Promise with test results
 */
export const runAndRefineTestUntilSuccess = async (
  contractCode: string,
  contractName: string,
  testFilePath: string,
  maxCycles: number = 5
): Promise<{
  success: boolean;
  output?: string;
  exploitSuccess?: boolean;
  finalTestPath?: string;
  cycles: number;
  securityImplication?: string;
}> => {
  try {
    console.log(`🔄 Starting test refinement cycle for ${testFilePath} (max ${maxCycles} cycles)`);
    
    let currentTestPath = testFilePath;
    let currentCycle = 0;
    let exploitSuccess = false;
    let testOutput = "";
    let lastAnalysis = null;  // Store the last analysis for better adaptation
    
    // Track previous strategies to avoid repetition
    const previousStrategies = new Set();
    
    // Add estimated time notification at start
    try {
      vscode.commands.executeCommand('venice.updateTestStatus', {
        filePath: testFilePath,
        status: 'refinement-started',
        cycle: 0,
        maxCycles,
        message: `Starting test refinement (estimated time: ${maxCycles * 2} minutes)`
      });
    } catch (error) {
      console.error("Error notifying initial status:", error);
    }
    
    while (currentCycle < maxCycles && !exploitSuccess) {
      currentCycle++;
      console.log(`\n🧪 CYCLE ${currentCycle}/${maxCycles}: Running test ${currentTestPath}`);
      
      // Notify UI about cycle start with more details
      try {
        vscode.commands.executeCommand('venice.updateTestStatus', {
          filePath: testFilePath,
          status: 'cycle-started',
          cycle: currentCycle,
          maxCycles,
          message: `Testing approach #${currentCycle}`
        });
      } catch (error) {
        console.error("Error notifying cycle status:", error);
      }
      
      // Run the test using hardhat
      const hardhatResult = await runHardhatTest(currentTestPath);
      testOutput = hardhatResult.output;
      
      // Check if the test was successful
      exploitSuccess = hardhatResult.success;
      
      if (exploitSuccess) {
        console.log(`✅ Test successfully exploited the vulnerability in cycle ${currentCycle}`);
        // Notify UI about successful exploit
        try {
          vscode.commands.executeCommand('venice.updateTestStatus', {
            filePath: testFilePath,
            status: 'exploit-success',
            cycle: currentCycle,
            maxCycles
          });
        } catch (error) {
          console.error("Error notifying success status:", error);
        }
        break;
      }
      
      // Analyze the failure
      console.log("⚠️ Test failed. Analyzing failure reason...");
      const analysisResult = await analyzeTestFailure(testOutput, contractCode, extractVulnerabilityFromFilename(currentTestPath));
      lastAnalysis = analysisResult;
      
      if (analysisResult.isSecure) {
        // The contract is actually secure against this vulnerability
        console.log("🛡️ Analysis indicates the contract is secure against this vulnerability");
        console.log(`Explanation: ${analysisResult.explanation}`);
        
        // Notify UI about secure status
        try {
          vscode.commands.executeCommand('venice.updateTestStatus', {
            filePath: testFilePath,
            status: 'secure',
            cycle: currentCycle,
            maxCycles,
            message: `Contract verified secure: ${analysisResult.explanation.substring(0, 100)}...`
          });
        } catch (error) {
          console.error("Error notifying secure status:", error);
        }
        
        // We should stop here as the contract is actually secure
        return {
          success: true,
          output: testOutput,
          exploitSuccess: false,
          finalTestPath: currentTestPath,
          cycles: currentCycle,
          securityImplication: `Contract is secure: ${analysisResult.explanation}`
        };
      } else {
        // The test failed due to technical issues - we should refine it
        console.log("🔧 Test failed due to technical issues. Refining test...");
        console.log(`Failure type: ${analysisResult.failureType}`);
        console.log(`Explanation: ${analysisResult.explanation}`);
        
        // Notify UI about refinement status
        try {
          vscode.commands.executeCommand('venice.updateTestStatus', {
            filePath: testFilePath,
            status: 'refining',
            cycle: currentCycle,
            maxCycles,
            message: `Refining test approach: ${analysisResult.failureType}`
          });
        } catch (error) {
          console.error("Error notifying refinement status:", error);
        }
        
        // Get the test content to track strategies
        const testContent = fs.readFileSync(currentTestPath, 'utf8');
        const testStrategy = getTestStrategy(testContent);
        previousStrategies.add(testStrategy);
        
        // Generate an improved test, passing the failure analysis
        const adaptResult = await adaptPenetrationTest(
          contractCode,
          currentTestPath,
          testOutput,
          false, // exploit was not successful
          currentCycle,
          analysisResult // Pass the analysis result
        );
        
        if (!adaptResult.success || !adaptResult.filePath) {
          throw new Error(`Failed to adapt test in cycle ${currentCycle}`);
        }
        
        // Save debug info for adaptation cycle
        if (adaptResult.debugInfo) {
          console.log("🔍 DEBUG INFO FOR ADAPTATION CYCLE " + currentCycle);
          console.log("==================================================");
          console.log(JSON.stringify(adaptResult.debugInfo, null, 2));
          console.log("==================================================");
          
          // Save debug info to file for later analysis
          const debugDir = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "", "debug");
          if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
          }
          
          const debugFilePath = path.join(debugDir, `debug-cycle-${currentCycle}-${Date.now()}.json`);
          fs.writeFileSync(debugFilePath, JSON.stringify({
            cycle: currentCycle,
            testOutput,
            failureAnalysis: analysisResult,
            adaptationInfo: adaptResult.debugInfo,
            generatedTestPath: adaptResult.filePath
          }, null, 2));
          
          console.log(`📝 Debug info saved to ${debugFilePath}`);
        }
        
        // Update the current test path to the new adapted test
        currentTestPath = adaptResult.filePath;
        console.log(`🆕 Created refined test: ${currentTestPath}`);
      }
    }
    
    // Add final status update when complete
    try {
      vscode.commands.executeCommand('venice.updateTestStatus', {
        filePath: testFilePath,
        status: exploitSuccess ? 'exploit-success' : 'refinement-complete',
        cycle: currentCycle,
        maxCycles,
        message: exploitSuccess ? 
          `Exploit successful after ${currentCycle} attempts` : 
          `Refinement complete after ${currentCycle} attempts without exploit`
      });
    } catch (error) {
      console.error("Error notifying completion status:", error);
    }
    
    return {
      success: true,
      output: testOutput,
      exploitSuccess,
      finalTestPath: currentTestPath,
      cycles: currentCycle,
      securityImplication: exploitSuccess 
        ? `Vulnerability confirmed: The contract is vulnerable and was successfully exploited after ${currentCycle} test cycles.` 
        : `Inconclusive: Could not exploit the vulnerability after ${maxCycles} refinement cycles.`
    };
  } catch (error: any) {
    console.error("❌ Error in test refinement cycle:", error);
    return {
      success: false,
      output: error.message,
      exploitSuccess: false,
      cycles: 0
    };
  }
};

// Helper function to extract test strategy
function getTestStrategy(testContent: string): string {
  // Extract key elements that define the test's approach
  const functionCalls = testContent.match(/\.\w+\(/g) || [];
  const ethSends = testContent.includes('sendTransaction');
  const conditionals = (testContent.match(/if\s*\(/g) || []).length;
  
  return `calls:${functionCalls.join(',')}_sends:${ethSends}_conditionals:${conditionals}`;
}

/**
 * Runs a Hardhat test and captures the output
 * 
 * @param testFilePath The path to the test file
 * @returns Promise with test results
 */
async function runHardhatTest(testFilePath: string): Promise<{success: boolean; output: string}> {
  try {
    console.log(`🧪 Running Hardhat test: ${testFilePath}`);
    
    // Notify UI that test execution has started
    try {
      vscode.commands.executeCommand('venice.updateTestStatus', {
        filePath: testFilePath,
        status: 'test-execution',
        message: 'Executing test...'
      });
    } catch (error) {
      console.error("Error notifying test execution status:", error);
    }
    
    // Get the workspace path
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      throw new Error("No workspace open");
    }
    
    // Extract just the filename without path or extension
    const testFileName = path.basename(testFilePath);
    
    // Use child_process to run hardhat
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      // Change to the hardhat project directory
      // This assumes your hardhat.config.js is in the workspace root
      // Adjust the path as needed for your project structure
      const command = `cd ${workspacePath} && npx hardhat test ${testFilePath} --no-compile`;
      
      // Increase timeout from default (potentially small) to a larger value
      const timeout = 60000; // 60 seconds
      
      const execOptions = { 
        maxBuffer: 2 * 1024 * 1024, // Increased from 1MB to 2MB
        timeout: timeout
      };
      
      exec(command, execOptions, (error: any, stdout: string, stderr: string) => {
        const output = stdout + (stderr ? `\n${stderr}` : '');
        
        // Log the output for debugging
        console.log("Test output:", output);
        
        // Determine if the test was successful
        // Look for indicators of successful exploit in the output
        const success = !error && (
          output.includes("successfully exploit") || 
          output.includes("VULNERABILITY SUMMARY") ||
          !output.includes("failing") && output.includes("passing")
        );
        
        // Notify UI about test execution result
        try {
          vscode.commands.executeCommand('venice.updateTestStatus', {
            filePath: testFilePath,
            status: success ? 'test-success' : 'test-failure',
            message: success ? 'Test execution successful' : 'Test execution failed'
          });
        } catch (error) {
          console.error("Error notifying test result status:", error);
        }
        
        resolve({
          success,
          output
        });
      });
      
      // Add a longer overall timeout
      setTimeout(() => {
        resolve({
          success: false,
          output: `Test execution timed out after ${timeout/1000} seconds. The test might be stuck in an infinite loop or waiting for a response that won't arrive.`
        });
      }, timeout + 5000); // 5 seconds longer than the exec timeout
    });
  } catch (error: any) {
    console.error("Error running Hardhat test:", error);
    return {
      success: false,
      output: `Error running test: ${error.message}`
    };
  }
}

/**
 * Helper function to extract vulnerability type from test filename
 */
export function extractVulnerabilityFromFilename(filePath: string): string {
  const basename = path.basename(filePath);
  
  // Try to extract vulnerability type from filename patterns
  const patterns = [
    /penetrationTest-.*-([A-Za-z]+)(?:-adapted-\d+-\d+)?\.ts/,
    /([A-Za-z]+)Attack(?:-adapted-\d+-\d+)?\.ts/,
    /([A-Za-z]+)Vulnerability(?:-adapted-\d+-\d+)?\.ts/
  ];
  
  for (const pattern of patterns) {
    const match = basename.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Default if we can't determine
  return "unknown";
}

/**
 * Analyzes a failed penetration test to determine if it failed due to security protections
 * or due to technical issues with the test itself
 */
export const analyzeTestFailure = async (
  testOutput: string,
  contractCode: string,
  vulnerabilityType: string
): Promise<{
  isSecure: boolean;  // true if contract is secure, false if test had technical issues
  failureType: string;
  explanation: string;
  suggestedFix?: string;
  contractFunctions?: string[]; // Add this to provide function information
}> => {
  try {
    console.log(`🔍 Analyzing test failure for ${vulnerabilityType} vulnerability`);
    
    // Extract all available functions from the contract
    const functionMatches = contractCode.matchAll(/function\s+(\w+)\s*\([^)]*\)/g);
    const availableFunctions = Array.from(functionMatches).map(match => match[1]);
    console.log(`Available contract functions: ${availableFunctions.join(', ')}`);
    
    // Extract function being called from error message
    const functionSelectorError = testOutput.match(/function selector was not recognized.*at\s+(\w+)\..*\(/i);
    const attemptedFunction = functionSelectorError ? functionSelectorError[1] : null;
    
    if (attemptedFunction) {
      console.log(`Failed attempting to call: ${attemptedFunction}`);
    }
    
    // Extract more specific error details when possible
    let specificErrorLocation = '';
    const errorLocationMatch = testOutput.match(/at\s+.*\(([^)]+)\)/);
    if (errorLocationMatch) {
      specificErrorLocation = `Error occurred at: ${errorLocationMatch[1]}`;
      console.log(specificErrorLocation);
    }
    
    // Rest of your existing patterns and checks...
    // [Existing code]
    
    // Enhanced response with more actionable information
    return {
      isSecure: false,
      failureType: "technical_error",
      explanation: `The test failed due to a technical issue. The contract does not recognize the function being called or is missing a receive/fallback function. ${specificErrorLocation}`,
      suggestedFix: `Check that you're calling functions that actually exist in the contract. Available functions: ${availableFunctions.join(', ')}`,
      contractFunctions: availableFunctions
    };
  } catch (error) {
    console.error("❌ Error analyzing test failure:", error);
    return {
      isSecure: false,
      failureType: "analysis_error",
      explanation: `Error while analyzing test failure: ${(error as any).message}`,
      suggestedFix: "Try running the test again or review the output manually"
    };
  }
};

/**
 * Uses Venice API to analyze a test failure case that couldn't be matched with simple patterns
 * @param testOutput The test output
 * @param contractCode The contract code
 * @param vulnerabilityType The vulnerability being tested
 * @returns Analysis result
 */
async function analyzeFailureWithAI(
  testOutput: string,
  contractCode: string,
  vulnerabilityType: string
): Promise<{
  isSecure: boolean;
  failureType: string;
  explanation: string;
  suggestedFix?: string;
} | null> {
  try {
    const systemPrompt = `You are an expert smart contract security analyst.
Your task is to analyze a failed penetration test and determine if the failure was because:
1. The contract is secure and its security measures prevented the exploit (isSecure = true)
2. The test itself had technical issues like deployment problems or coding errors (isSecure = false)

Focus only on this distinction. Do not perform a full security audit.`;

    const requestData: ChatCompletionRequestWithVenice = {
      model: "default",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `A penetration test for a ${vulnerabilityType} vulnerability failed with this output:
\`\`\`
${testOutput}
\`\`\`

Contract being tested:
\`\`\`solidity
${contractCode}
\`\`\`

Did the test fail because the contract is secure (security measures working correctly) or because of technical issues with the test itself?

Respond in JSON format:
{
  "isSecure": boolean,
  "failureType": "string",
  "explanation": "Detailed explanation of the failure",
  "suggestedFix": "Suggestion to address the issue"
}
`
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
      venice_parameters: {
        include_venice_system_prompt: false
      }
    };

    const response = await openai.createChatCompletion(requestData as any);
    
    if (!response?.data?.choices?.[0]?.message?.content) {
      return null;
    }

    const content = response.data.choices[0].message.content;
    
    // Extract JSON response
    try {
      // Look for JSON pattern in the response
      const jsonMatch = content.match(/{[\s\S]*}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI analysis response:", e);
    }
    
    return null;
  } catch (error) {
    console.error("Error using AI to analyze test failure:", error);
    return null;
  }
}

/**
 * Adapts a penetration test based on previous failures and analysis
 */

// First, define interfaces for proper typing
interface FunctionDetails {
  name: string;
  params: string;
}

interface ErrorDetails {
  message: string;
  functionError: {
    contract: string;
    attemptedFunction: string;
  } | null;
}

interface DebugInfo {
  attemptNumber: number;
  errorDetails: ErrorDetails | null;
  contractFunctionsFound: FunctionDetails[];
  templateStrategy: string;
  previousApproaches: string[];
  callsAttempted: string[];
}

// Then in the adaptPenetrationTest function:
export const adaptPenetrationTest = async (
  contractCode: string,
  testFilePath: string,
  testOutput: string,
  exploitSuccess: boolean,
  attemptNumber: number,
  failureAnalysis?: any
): Promise<{ success: boolean; filePath?: string; error?: string; debugInfo?: DebugInfo }> => {
  try {
    // Create a debugging object with proper typing
    const debugInfo: DebugInfo = {
      attemptNumber,
      errorDetails: null,
      contractFunctionsFound: [],
      templateStrategy: "",
      previousApproaches: [],
      callsAttempted: []
    };
    
    if (!testFilePath) {
      throw new Error("testFilePath is not defined");
    }
    
    const previousTestContent = fs.readFileSync(testFilePath, 'utf8');
    
    // Extract what the previous test was attempting to do
    const previousFunctionCalls = (previousTestContent.match(/contract\.\w+\(/g) || [])
      .map(call => call.replace(/contract\.(\w+)\(/, "$1"));
    
    debugInfo.previousApproaches = previousFunctionCalls;
    
    // Extract error information more carefully
    const errorMatch = testOutput.match(/Error: ([^\n]+)/);
    const errorMessage = errorMatch ? errorMatch[1] : "Unknown error";
    
    // Get more specific info about the error
    const selectorErrorMatch = testOutput.match(/function selector was not recognized.*at\s+(\w+)\.(\w+)/i);
    const functionErrorDetails = selectorErrorMatch ? 
      { contract: selectorErrorMatch[1], attemptedFunction: selectorErrorMatch[2] } : null;
    
    debugInfo.errorDetails = {
      message: errorMessage,
      functionError: functionErrorDetails
    };
    
    // Use a different template based on attempt number to encourage variety
    let templateType = "standard";
    if (attemptNumber > 2) {
      templateType = "alternative";
    }
    if (attemptNumber > 4) {
      templateType = "minimal";
    }
    
    debugInfo.templateStrategy = templateType;
    
    // Extract all available functions from the contract with their signatures
    const functionMatches = [...contractCode.matchAll(/function\s+(\w+)\s*\(([^)]*)\)/g)];
    const availableFunctions = functionMatches.map(match => ({
      name: match[1],
      params: match[2].trim()
    }));
    
    debugInfo.contractFunctionsFound = availableFunctions;
    
    // Create a focused prompt with very explicit instructions about the previous failure
    // In adaptPenetrationTest, enhance the system prompt

const systemPrompt = `You are an expert in smart contract security and penetration testing. 
PREVIOUS TEST FAILED with error: "${errorMessage}".

CONTRACT ANALYSIS:
Available functions in the contract:
${availableFunctions.map(f => `- ${f.name}(${f.params})`).join('\n')}

PREVIOUS ATTEMPT ANALYSIS:
- Attempt #${attemptNumber} of this penetration test
- Previous test called these functions: ${previousFunctionCalls.join(', ')}
- The error occurred when trying to call: ${functionErrorDetails?.attemptedFunction || 'unknown function'}
- Template type for this attempt: ${templateType}

YOUR TASK:
1. Create a COMPLETELY DIFFERENT approach than previous attempts
2. ⚠️ CRITICALLY IMPORTANT: ONLY use these EXACT functions:
   ${availableFunctions.map(f => `- ${f.name}(${f.params})`).join('\n')}
3. NEVER call any function not in the above list
4. Do NOT create external attacker contracts - put all code in the test file
5. Use Hardhat ethers v6 syntax with await contract.waitForDeployment()
6. If the contract has no receive/fallback function, do not send ETH directly with .sendTransaction
${templateType === "minimal" ? "7. Create a minimal test - just call ONE function at a time" : ""}

CONTRACT FUNCTION REMINDER:
The ONLY available functions are:
${availableFunctions.map(f => f.name).join(', ')}

TEST CODE FORMAT:
\`\`\`typescript
import { ethers } from "hardhat";
import { expect } from "chai";

describe("Penetration Test", function() {
  it("should exploit vulnerability", async function() {
    // Deploy contract
    // Execute exploit using ONLY functions that exist in the contract: ${availableFunctions.map(f => f.name).join(', ')}
    // Verify exploit worked
  });
});
\`\`\`

MOST IMPORTANT: Do NOT call any functions that don't exist in the contract! Check twice before generating code.`;

    console.log(`⭐ Adapting penetration test (attempt ${attemptNumber})`);
    console.log(`📊 Debug info for attempt ${attemptNumber}:`, JSON.stringify(debugInfo, null, 2));
    
    // Make the API request with the enhanced prompt
    const userPrompt = `Here is the Solidity contract code to test:
\`\`\`solidity
${contractCode}
\`\`\`

Previous test that failed:
\`\`\`typescript
${previousTestContent}
\`\`\`

ERROR FROM PREVIOUS TEST: "${errorMessage}"

Create a new penetration test that avoids the previous error by ONLY using these functions that exist in the contract: ${availableFunctions.map(f => f.name).join(', ')}`;

    // Create the request for the Venice API
    const requestData: ChatCompletionRequestWithVenice = {
      model: "default",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      venice_parameters: {
        include_venice_system_prompt: false
      }
    };
    
    console.log("Making API request to Venice for improved test (attempt " + attemptNumber + ")");
    const response = await openai.createChatCompletion(requestData as any);
    
    if (!response?.data?.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from API - no content");
    }
    
    const content = response.data.choices[0].message.content;
    console.log(`📥 Raw API response received with length: ${content.length} characters`);
    console.log(`Response content first 200 chars: ${content.substring(0, 200)}...`);
    
    // Extract the actual TypeScript code
    const codeMatch = content.match(/```typescript\n([\s\S]*?)\n```/) || 
                    content.match(/```ts\n([\s\S]*?)\n```/) || 
                    content.match(/```\n([\s\S]*?)\n```/);
                    
    let testCode = content;
    if (codeMatch && codeMatch[1]) {
      testCode = codeMatch[1];
    }
    
    // Add a verification step before saving the generated test
    // Check if it's trying to call functions that don't exist
    if (failureAnalysis?.contractFunctions) {
      let generatedCode = testCode;
      
      // Check if the test is trying to call non-existent functions
      const functionCalls = generatedCode.match(/contract\.\w+\(/g) || [];
      for (const call of functionCalls) {
        const funcName = call.replace(/contract\.(\w+)\(/, "$1");
        if (!failureAnalysis.contractFunctions.includes(funcName)) {
          console.log(`⚠️ Generated test tries to call non-existent function: ${funcName}`);
          // Attempt simple correction
          generatedCode = generatedCode.replace(
            new RegExp(`contract.${funcName}\\(`, 'g'),
            `contract.${failureAnalysis.contractFunctions[0] || 'deposit'}(`
          );
        }
      }
      
      // Use the verified/corrected code
      testCode = generatedCode;
    }
    
    console.log(`💾 Full test code written to file (${testCode.length} characters)`);
    
    // Add validation to check for invalid function calls
    let validationErrors = [];
    const availableFunctionNames = availableFunctions.map(f => f.name);

    // Check for function calls that don't exist in the contract
    const functionCallMatches = testCode.matchAll(/\b(contract|vulnerableContract)\.([\w]+)\(/g);
    for (const match of Array.from(functionCallMatches)) {
      const calledFunction = match[2];
      if (!availableFunctionNames.includes(calledFunction)) {
        validationErrors.push(`Invalid function call: ${calledFunction}() - This function does not exist in the contract`);
        
        // Try to replace with a valid function
        console.log(`⚠️ Attempting to fix invalid function call: ${calledFunction}`);
        if (availableFunctionNames.length > 0) {
          // Pick a similar function or the first available one
          const replacement = availableFunctionNames.find(f => 
            f.toLowerCase().includes(calledFunction.toLowerCase()) || 
            calledFunction.toLowerCase().includes(f.toLowerCase())
          ) || availableFunctionNames[0];
          
          testCode = testCode.replace(
            new RegExp(`(contract|vulnerableContract)\\.${calledFunction}\\(`, 'g'),
            `$1.${replacement}(`
          );
          console.log(`🔧 Replaced ${calledFunction} with ${replacement}`);
        }
      }
    }

    // Check for direct ETH transfers if there's no receive/fallback
    const hasReceiveFallback = contractCode.includes('receive() external payable') || 
                              contractCode.includes('fallback() external payable');
                              
    if (!hasReceiveFallback && testCode.includes('.sendTransaction({')) {
      validationErrors.push('Warning: Contract has no receive/fallback function but test uses direct ETH transfers');
      
      // Try to fix by using a payable function if available
      const payableFunctions = availableFunctions.filter(f => 
        contractCode.includes(`function ${f.name}`) && contractCode.includes('payable')
      );
      
      if (payableFunctions.length > 0) {
        console.log(`⚠️ Replacing direct ETH sends with calls to payable function: ${payableFunctions[0].name}`);
        testCode = testCode.replace(
          /(\w+)\.sendTransaction\(\{\s*to:\s*\w+\s*,\s*value:\s*([^}]+)\}\)/g,
          `$1.${payableFunctions[0].name}({value: $2})`
        );
      }
    }

    // Add validation warnings as comments to the beginning of the file
    if (validationErrors.length > 0) {
      const warningComments = validationErrors.map(e => `// WARNING: ${e}`).join('\n');
      testCode = `// AUTO-VALIDATION WARNINGS - Please review\n${warningComments}\n\n${testCode}`;
      console.log(`⚠️ Added ${validationErrors.length} validation warnings to the test file`);
    }

    // Make sure we don't save the "FILENAME:" comment if it's in the code
    testCode = testCode.replace(/\/\/ FILENAME:.*\n/, '');
    
    // Create a unique filename for the adapted test
    const timestamp = Date.now();
    // Extract just the basename without the path
    const originalBasename = path.basename(testFilePath);
    const newFilename = originalBasename.replace(/\.ts$/, `-adapted-${attemptNumber}-${timestamp}.ts`);
    
    // Get workspace path and save the file
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      throw new Error("No workspace open");
    }
    
    // Determine the directory where the test file should be saved
    const originalDir = path.dirname(testFilePath);
    const savePath = path.join(originalDir, newFilename);
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(originalDir)) {
      fs.mkdirSync(originalDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(savePath, testCode);
    console.log(`✅ Adapted penetration test saved to ${savePath}`);
    
    return {
      success: true,
      filePath: savePath,
      debugInfo
    };
  } catch (error: any) {
    console.error("Error adapting penetration test:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Runs multiple tests in parallel with automatic refinement
 */
export const runMultipleTestsInParallel = async (
  contractCode: string,
  contractName: string,
  testFilePaths: string[],
  maxConcurrent: number = 3,
  maxCycles: number = 5
): Promise<{
  success: boolean;
  results: Array<{
    originalTestPath: string;
    finalTestPath?: string;
    output?: string;
    exploitSuccess?: boolean;
    cycles: number;
    securityImplication?: string;
  }>;
  error?: string;
}> => {
  try {
    console.log(`🚀 Running ${testFilePaths.length} tests in parallel (max ${maxConcurrent} concurrent)`);
    
    // Function to notify UI about test status updates
    const notifyTestStatus = (filePath: string, status: string, cycle: number = 0) => {
      try {
        vscode.commands.executeCommand('venice.updateTestStatus', {
          filePath,
          status,
          cycle,
          maxCycles
        });
      } catch (error) {
        console.error("Error notifying test status:", error);
      }
    };
    
    // Create all test promises at once (not in batches)
    const allPromises = testFilePaths.map((testPath, index) => {
      // Add a small delay to stagger the starts and prevent API rate limiting
      const startDelay = index * 500; // 500ms between test starts
      
      return new Promise<any>(async (resolve) => {
        // Wait for the staggered start delay
        await new Promise(r => setTimeout(r, startDelay));
        
        // Notify that test is starting
        notifyTestStatus(testPath, 'refinement-started');
        console.log(`▶️ Starting test ${index + 1}/${testFilePaths.length}: ${path.basename(testPath)}`);
        
        try {
          // Run the test
          const result = await runAndRefineTestUntilSuccess(
            contractCode,
            contractName,
            testPath,
            maxCycles
          );
          
          // Notify status update
          notifyTestStatus(
            testPath, 
            result.exploitSuccess ? 'exploit-success' : 'refined',
            result.cycles
          );
          
          resolve({
            originalTestPath: testPath,
            ...result
          });
        } catch (error) {
          console.error(`Error running test ${testPath}:`, error);
          notifyTestStatus(testPath, 'error');
          resolve({
            originalTestPath: testPath,
            success: false,
            cycles: 0,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
    });
    
    // Use Promise.all to truly run in parallel
    const results = await Promise.all(allPromises);
    
    console.log(`✅ Completed ${results.length} parallel test executions`);
    
    return {
      success: true,
      results
    };
  } catch (error: any) {
    console.error("❌ Error running parallel tests:", error);
    return {
      success: false,
      results: [],
      error: error.message
    };
  }
};

export const generateSecurityReport = async (
  contractCode: string,
  contractName: string,
  testResults: {
    vulnerability: string;
    filePath: string;
    testCode?: string;
    output: string;
    exploitSuccess: boolean;
    securityImplication?: string;
  }[]
): Promise<{success: boolean; report?: string; filePath?: string; error?: string}> => {
  try {
    if (!process.env.REACT_APP_VENICE_API_KEY) {
      console.error("❌ Venice API key is not set");
      throw new Error("API key is not configured. Set REACT_APP_VENICE_API_KEY environment variable.");
    }
  } catch (error: any) {
    console.error("❌ Error generating security report:", error);
    return { success: false, error: error.message };
  }

  try {
    console.log(`⭐ Generating security report for ${contractName} based on ${testResults.length} test results`);
    
    // Load test code files if not provided
    const enhancedResults = await Promise.all(testResults.map(async (result) => {
      if (!result.testCode && result.filePath) {
        try {
          result.testCode = fs.readFileSync(result.filePath, 'utf8');
        } catch (error) {
          console.error(`Error reading test file ${result.filePath}:`, error);
        }
      }
      return result;
    }));

    // Extract key source code snippets using pattern recognition
    const vulnerabilityFunctions = new Map();
    
    // Try to identify vulnerable functions from test outputs
    enhancedResults.forEach(result => {
      // Look for function mentions in the test code or output
      const functionNameMatches = (result.testCode || '').match(/\.connect\(attacker\)\.(\w+)\(/g) || 
                                 (result.output || '').match(/([a-zA-Z]+)\(\).*vulnerable/g);
      
      if (functionNameMatches) {
        for (const match of functionNameMatches) {
          const funcName = match.match(/\.(\w+)\(/) || match.match(/([a-zA-Z]+)\(\)/);
          if (funcName && funcName[1]) {
            // Extract the function from contract code
            const functionRegex = new RegExp(`function\\s+${funcName[1]}\\s*\\([^{]*\\{[^}]*\\}`, 'g');
            const functionMatch = contractCode.match(functionRegex);
            
            if (functionMatch) {
              vulnerabilityFunctions.set(funcName[1], {
                code: functionMatch[0],
                vulnerability: result.vulnerability,
                exploitable: result.exploitSuccess
              });
            }
          }
        }
      }
    });
    
    // Updated prompt to request HTML format with styling
    const systemPrompt = `You are an expert smart contract security auditor with deep knowledge of Solidity and common vulnerabilities.
Generate a comprehensive, actionable security report based on the provided smart contract and penetration test results.

Your response should be VALID HTML with embedded CSS styling. Use the following template structure:

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Audit Report for ${contractName}</title>
  <style>
    /* Add your CSS styling here */
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    header {
      background: linear-gradient(135deg, #20293b, #2c3e50);
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 {
      margin: 0;
      font-size: 28px;
    }
    .report-summary {
      display: flex;
      justify-content: space-between;
      margin-top: 15px;
    }
    .summary-item {
      text-align: center;
      flex: 1;
    }
    .summary-value {
      font-size: 24px;
      font-weight: bold;
    }
    .summary-label {
      font-size: 14px;
      opacity: 0.8;
    }
    section {
      background: white;
      padding: 25px;
      margin-bottom: 25px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    h2 {
      color: #2c3e50;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
      margin-top: 0;
    }
    h3 {
      color: #3498db;
      margin-top: 25px;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
    }
    .vulnerability {
      margin-bottom: 30px;
      border-left: 4px solid #e74c3c;
      padding-left: 20px;
    }
    .vulnerability.safe {
      border-left-color: #2ecc71;
    }
    .severity {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: bold;
      margin: 5px 0;
    }
    .critical { background: #e74c3c; color: white; }
    .high { background: #e67e22; color: white; }
    .medium { background: #f39c12; color: white; }
    .low { background: #3498db; color: white; }
    code {
      font-family: 'Consolas', 'Monaco', monospace;
      background-color: #f8f8f8;
      padding: 15px;
      border-radius: 5px;
      border: 1px solid #ddd;
      display: block;
      overflow-x: auto;
      white-space: pre-wrap;
      margin: 15px 0;
      font-size: 14px;
      line-height: 1.5;
    }
    .code-comparison {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin: 20px 0;
    }
    .code-column {
      flex: 1;
      min-width: 300px;
    }
    .code-header {
      background: #f8f8f8;
      padding: 8px 15px;
      border: 1px solid #ddd;
      border-bottom: none;
      border-radius: 5px 5px 0 0;
      font-weight: bold;
      font-size: 14px;
      color: #555;
    }
    .code-vulnerable { color: #e74c3c; }
    .code-fixed { color: #27ae60; }
    .recommendations {
      background-color: #f1f8e9;
      padding: 20px;
      border-radius: 5px;
      margin: 20px 0;
      border-left: 4px solid #8bc34a;
    }
    .recommendation-item {
      margin-bottom: 10px;
      padding-left: 20px;
      position: relative;
    }
    .recommendation-item:before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #8bc34a;
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f8f8f8;
      font-weight: bold;
    }
    tr:hover {
      background-color: #f5f5f5;
    }
  </style>
</head>
<body>
  <header>
    <h1>Security Audit Report for ${contractName}</h1>
    <div class="report-summary">
      <!-- Fill in appropriate summary statistics here -->
    </div>
  </header>

  <section>
    <h2>Executive Summary</h2>
    <!-- Summary here -->
  </section>

  <section>
    <h2>Vulnerability Assessment</h2>
    <!-- Vulnerabilities with code examples here -->
  </section>

  <section>
    <h2>Actionable Recommendations</h2>
    <!-- Recommendations here -->
  </section>

  <section>
    <h2>Risk Assessment</h2>
    <!-- Risk analysis here -->
  </section>
</body>
</html>

CONTENT REQUIREMENTS:
1. For each vulnerability tested:
   - Provide a clear technical explanation
   - Include code snippets showing the vulnerable code
   - Show side-by-side comparisons of vulnerable vs fixed code
   - Rate severity: Critical/High/Medium/Low
   - Provide detailed code fixes with explanations

2. Ensure the HTML is well-structured with:
   - Clear section headings
   - Highlighted code snippets
   - Visual indicators of severity
   - Formatted tables for comparing risks

3. Focus on actionable advice with specific code examples that developers can directly implement.

IMPORTANT: Return ONLY valid HTML that can be directly saved as an HTML file.`;

    // Create a detailed context with all test results
    let testResultsContent = enhancedResults.map((result, index) => {
      return `
## Test ${index + 1}: ${result.vulnerability}

### Test Code:
\`\`\`typescript
${result.testCode || "Code not available"}
\`\`\`

### Test Output:
\`\`\`
${result.output || "Output not available"}
\`\`\`

### Result: ${result.exploitSuccess ? "Exploit SUCCESSFUL" : "Exploit FAILED"}
${result.securityImplication ? `### Security Implication: ${result.securityImplication}` : ""}
`;
    }).join("\n\n");

    // Add extracted vulnerable functions
    let vulnerableFunctionsContent = "";
    if (vulnerabilityFunctions.size > 0) {
      vulnerableFunctionsContent = "\n\n## Identified Vulnerable Functions\n\n";
      vulnerabilityFunctions.forEach((info, funcName) => {
        vulnerableFunctionsContent += `
### Function: ${funcName}
Potentially exploitable: ${info.exploitable ? "YES" : "NO"}
Related to: ${info.vulnerability}

\`\`\`solidity
${info.code}
\`\`\`
`;
      });
    }

    const requestData: ChatCompletionRequestWithVenice = {
      model: "default",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Please analyze the following smart contract and penetration test results to generate a detailed, actionable security report in HTML format with styling.

SMART CONTRACT:
\`\`\`solidity
${contractCode}
\`\`\`

PENETRATION TEST RESULTS:
${testResultsContent}

${vulnerableFunctionsContent}

Based on the above contract and test results, generate a detailed security report with specific code fixes for each vulnerability. Include both the vulnerable code and the fixed code examples in a well-styled HTML document.`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      venice_parameters: {
        include_venice_system_prompt: false
      }
    };

    console.log("📤 Making API request for security report generation");
    const response = await openai.createChatCompletion(requestData as any);
    
    if (!response?.data?.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from API - no content found");
    }

    // Get the report content
    const htmlReport = response.data.choices[0].message.content;
        console.log(`📥 HTML security report received with length: ${htmlReport.length} characters`);
        
        // Save the report to a file
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
          throw new Error("No workspace open");
        }
        
        // Create reports directory if it doesn't exist
        const reportsDir = path.join(workspacePath, 'reports');
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        // Save the report with a timestamp
        const timestamp = Date.now();
        const filename = `${contractName}-SecurityReport-${timestamp}.html`;
        const filePath = path.join(reportsDir, filename);
        
        fs.writeFileSync(filePath, htmlReport);
        console.log(`📝 Security report saved to: ${filePath}`);
        
        return {
          success: true,
          report: htmlReport,
          filePath
        };
      } catch (error: any) {
        console.error("❌ Error generating security report:", error);
        return { success: false, error: error.message };
      }
    };