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
  apiKey: process.env.REACT_APP_VENICE_API_KEY || "",
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
 * Translates a contract to a different language - updated to use OpenAI SDK
 */
export const translateContract = async (
  sourceCode: string, 
  targetLanguage: string
): Promise<string> => {
  try {
    const requestData: ChatCompletionRequestWithVenice = {
      model: "default",
      messages: [
        {
          role: "system",
          content: `You are an expert in blockchain development across multiple platforms. 
          Translate the provided smart contract code into ${targetLanguage} with appropriate 
          equivalent functionality. Include comments explaining key differences between the platforms.`
        },
        {
          role: "user",
          content: `Translate this smart contract to ${targetLanguage}:\n\n${sourceCode}`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      venice_parameters: {
        include_venice_system_prompt: false
      }
    };

    try {
      const response = await openai.createChatCompletion(requestData as any);

      // Add null check for response data
      if (!response?.data?.choices?.[0]?.message?.content) {
        return 'Failed to translate contract. No response from API.';
      }

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('Error calling Venice API:', error.message);
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return `Unable to connect to translation service. Please check your network connection and try again.\n\nError: ${error.message}`;
      } else {
        return `Failed to translate contract to ${targetLanguage}. API error: ${error.message}`;
      }
    }
  } catch (error: any) {
    console.error('Unexpected error in translateContract:', error);
    return `An unexpected error occurred: ${error.message}`;
  }
};

/**
 * Assesses insurance aspects of a contract - updated to use OpenAI SDK
 */
export const assessInsurance = async (
  contractCode: string, 
  tvl: number
): Promise<any> => {
  try {
    const requestData: ChatCompletionRequestWithVenice = {
      model: "default",
      messages: [
        {
          role: "system",
          content: `You are an expert in smart contract risk assessment and insurance. 
          Analyze the provided contract to determine its risk level and appropriate insurance premium 
          recommendations. Consider factors like reentrancy, access control, overflow/underflow, and 
          overall code quality. For a contract with TVL (Total Value Locked) of $${tvl}, 
          recommend an appropriate premium percentage and coverage terms.
          
          Respond with a JSON object with this structure:
          {
            "risk_score": number from 0-100,
            "premium_percentage": number (e.g., 2.5 for 2.5%),
            "coverage_limit": string (e.g., "$1,000,000"),
            "risk_factors": array of strings describing risk factors,
            "risk_level": "Low", "Medium", or "High",
            "policy_recommendations": array of strings with policy details,
            "exclusions": array of strings listing what wouldn't be covered
          }`
        },
        {
          role: "user",
          content: `Assess the insurance risk and premium for this smart contract with TVL of $${tvl}:\n\n${contractCode}`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      venice_parameters: {
        include_venice_system_prompt: false
      }
    };

    try {
      const response = await openai.createChatCompletion(requestData as any);

      // Add null check for response data
      if (!response?.data?.choices?.[0]?.message?.content) {
        throw new Error('Empty or invalid response from API');
      }

      const content = response.data.choices[0].message.content || "";
      
      // Try to parse the response as JSON
      try {
        // Extract JSON object if it's embedded in markdown or text
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                          content.match(/```\n([\s\S]*?)\n```/) || 
                          content.match(/{[\s\S]*?}/);
                          
        if (!jsonMatch) {
          throw new Error('Could not find valid JSON in response');
        }
        
        const jsonStr = jsonMatch[0].replace(/```json\n|```\n|```/g, '');
        return JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse JSON from API response:", e);
        // Return the raw content as a fallback
        return {
          risk_score: 50,
          premium_percentage: 5,
          coverage_limit: `$${Math.floor(tvl * 0.8).toLocaleString()}`,
          risk_factors: [typeof content === 'string' ? content : "No analysis available"],
          risk_level: "Medium",
          policy_recommendations: ["Standard coverage recommended"],
          exclusions: ["Intentional vulnerabilities", "Social engineering attacks"]
        };
      }
    } catch (error: any) {
      console.error('Error calling Venice API:', error.message);
      
      // Generate offline insurance assessment
      return {
        risk_score: 50,
        premium_percentage: 5,
        coverage_limit: `$${Math.floor(tvl * 0.8).toLocaleString()}`,
        risk_factors: [`Could not connect to analysis service: ${error.message}`, "Using default risk assessment"],
        risk_level: "Medium",
        policy_recommendations: ["Standard coverage recommended", "Manual code review recommended"],
        exclusions: ["Intentional vulnerabilities", "Social engineering attacks"],
        error_info: `API connection error: ${error.message}`,
        offline_mode: true
      };
    }
  } catch (error: any) {
    console.error('Unexpected error in assessInsurance:', error);
    return {
      error: `Failed to assess insurance risk: ${error.message}`,
      offline_mode: true,
      risk_level: "Medium",
      premium_percentage: 5
    };
  }
};

/**
 * Generates a TypeScript penetration test for a smart contract
 * 
 * @param contractCode The source code of the contract to test
 * @param contractName The name of the contract
 * @param vulnerabilityType Optional specific vulnerability to target
 * @param customPrompt Optional custom prompt for the test generation
 * @returns Promise with result containing the file path and test information
 */
export const generatePenetrationTest = async (
  contractCode: string,
  contractName: string,
  vulnerabilityType?: string,
  customPrompt?: string
): Promise<{success: boolean; filePath?: string; error?: string}> => {
  try {
    if (!process.env.REACT_APP_VENICE_API_KEY) {
      console.error("❌ Venice API key is not set");
      throw new Error("API key is not configured. Set REACT_APP_VENICE_API_KEY environment variable.");
    }

    console.log(`⭐ Generating penetration test for ${contractName}${vulnerabilityType ? ` targeting ${vulnerabilityType}` : ''}`);
    console.log(`Contract code length: ${contractCode.length} characters`);
    console.log(`First 200 chars: ${contractCode.substring(0, 200).replace(/\n/g, '\\n')}...`);
    
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

4. FOCUS on testing ONE specific vulnerability type per test:
   - Reentrancy
   - Access control issues
   - Integer overflow/underflow
   - Front-running
   - Logic errors

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
    
    // Set up the environment for the exploit
    // e.g., send funds to the contract
    await owner.sendTransaction({
      to: contractAddress,
      value: ethers.parseEther("1.0")
    });
    
    // EXPLOIT IMPLEMENTATION
    console.log("Executing exploit...");
    
    // Example for reentrancy: Create a series of transactions with specific conditions
    const initialAttackerBalance = await ethers.provider.getBalance(attacker.address);
    console.log("Initial attacker balance:", ethers.formatEther(initialAttackerBalance));
    
    // Step 1: Attacker interacts with the contract
    await vulnerableContract.connect(attacker).someFunction({ value: ethers.parseEther("0.1") });
    
    // Step 2: Execute the attack
    await vulnerableContract.connect(attacker).withdrawFunds();  // Or whatever vulnerable function exists
    
    // Verification
    console.log("Verifying exploit results...");
    
    // Add assertions to verify the exploit worked
    const finalAttackerBalance = await ethers.provider.getBalance(attacker.address);
    console.log("Final attacker balance:", ethers.formatEther(finalAttackerBalance));
    
    // Use chai assertions
    expect(await ethers.provider.getBalance(contractAddress)).to.equal(0n);
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

Your penetration test must be a single self-contained file that can run without additional dependencies.`;

    const requestData: ChatCompletionRequestWithVenice = {
      model: "default",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: customPrompt 
            ? `${customPrompt}\n\nContract Code:\n\n${contractCode}`
            : `Analyze this smart contract for vulnerabilities and create a penetration test${vulnerabilityType ? ` targeting ${vulnerabilityType}` : ''}:\n\n${contractCode}`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      venice_parameters: {
        include_venice_system_prompt: false
      }
    };

    console.log("📤 Making API request for penetration test generation");
    const response = await openai.createChatCompletion(requestData as any);
    
    if (!response?.data?.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from API - no content found");
    }

    // Get the generated test content
    const content = response.data.choices[0].message.content;
    console.log(`📥 Raw API response received with length: ${content.length} characters`);
    console.log(`Response content first 200 chars: ${content.substring(0, 200).replace(/\n/g, '\\n')}...`);
    
    // Extract the filename from the content if available
    let filename = `penetrationTest-${contractName}-${Date.now()}.ts`;
    const filenameMatch = content.match(/FILENAME: ([a-zA-Z0-9_\-\.]+\.ts)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1];
    }
    
    // Extract the actual TypeScript code
    const codeMatch = content.match(/```typescript\n([\s\S]*?)\n```/) || 
                      content.match(/```ts\n([\s\S]*?)\n```/) || 
                      content.match(/```\n([\s\S]*?)\n```/);
                      
    let testCode = content;
    if (codeMatch && codeMatch[1]) {
      testCode = codeMatch[1];
    }
    
    // NEW: Validate and correct the test before saving
    console.log("🧪 Validating and correcting penetration test...");
    try {
      const validationResult = await validateAndCorrectTest(
        testCode, 
        contractCode, 
        vulnerabilityType || "unknown"
      );
      
      if (validationResult.success && validationResult.correctedCode) {
        console.log("✅ Test validation and correction successful");
        testCode = validationResult.correctedCode;
      } else {
        console.warn("⚠️ Test validation failed, using original code:", validationResult.error);
      }
    } catch (validationError) {
      console.error("❌ Error during test validation:", validationError);
      // Continue with original code if validation fails
    }
    
    // Make sure we don't save the "FILENAME:" comment if it's in the code
    testCode = testCode.replace(/\/\/ FILENAME:.*\n/, '');
    
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
    
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, testCode);
    console.log(`💾 Full test code written to file (${testCode.length} characters)`);
    
    console.log(`✅ Penetration test saved to ${filePath}`);
    
    return {
      success: true,
      filePath
    };
    
  } catch (error: any) {
    console.error("❌ Error generating penetration test:", error);
    console.error("Error details:", error.stack || "No stack trace available");
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generates multiple penetration tests based on detected vulnerabilities
 * 
 * @param contractCode The source code of the contract to test
 * @param contractName The name of the contract
 * @param vulnerabilities Array of vulnerabilities detected in analysis
 * @returns Promise with array of test results
 */
export const generateMultiplePenetrationTests = async (
  contractCode: string,
  contractName: string,
  vulnerabilities: {name: string, description: string, severity: string}[]
): Promise<{
  success: boolean; 
  tests: {
    vulnerability: string;
    filePath: string;
    success?: boolean;
    exploitSuccess?: boolean;
    output?: string;
    securityImplication?: string;
  }[]; 
  error?: string
}> => {
  try {
    console.log(`⭐ Generating ${vulnerabilities.length} penetration tests for ${contractName}`);
    
    // Array to store test results
    const tests: {vulnerability: string, filePath: string, success?: boolean, exploitSuccess?: boolean, output?: string, securityImplication?: string}[] = [];
    
    // Generate a test for each vulnerability
    for (const vulnerability of vulnerabilities) {
      console.log(`Generating test for vulnerability: ${vulnerability.name}`);
      
      try {
        // Prepare a more specific prompt for this vulnerability
        const specificPrompt = `Based on the following vulnerability: "${vulnerability.name}" - ${vulnerability.description}
        
        Create a penetration test that specifically exploits this vulnerability. Focus on a 
        targeted test that clearly demonstrates how the vulnerability can be exploited.`;
        
        // Generate the test
        const result = await generatePenetrationTest(
          contractCode, 
          contractName, 
          vulnerability.name
        );
        
        if (result.success && result.filePath) {
          tests.push({
            vulnerability: vulnerability.name,
            filePath: result.filePath
          });
        } else {
          console.error(`Failed to generate test for ${vulnerability.name}: ${result.error}`);
        }
      } catch (error: any) {
        console.error(`Error generating test for ${vulnerability.name}:`, error);
      }
      
      // Add a small delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (tests.length === 0) {
      return {
        success: false,
        tests: [],
        error: "Could not generate any penetration tests"
      };
    }
    
    return {
      success: true,
      tests
    };
  } catch (error: any) {
    console.error("❌ Error generating multiple penetration tests:", error);
    return {
      success: false,
      tests: [],
      error: error.message
    };
  }
};

/**
 * Analyzes test results and generates an improved test
 * 
 * @param contractCode The original contract code
 * @param testFilePath Path to the original test file
 * @param testOutput Output from the previous test run
 * @param exploitSuccess Whether the previous exploit was successful
 * @param attemptNumber Current attempt number
 * @returns Promise with path to the new test file
 */
export const adaptPenetrationTest = async (
  contractCode: string,
  testFilePath: string,
  testOutput: string,
  exploitSuccess: boolean,
  attemptNumber: number
): Promise<{ success: boolean; filePath?: string; error?: string }> => {
  try {
    if (!process.env.REACT_APP_VENICE_API_KEY) {
      console.error("❌ Venice API key is not set");
      throw new Error("API key is not configured. Set REACT_APP_VENICE_API_KEY environment variable.");
    }

    console.log(`⭐ Adapting penetration test (attempt ${attemptNumber})`);
    
    // Read the original test file
    let testFileContent = '';
    try {
      testFileContent = fs.readFileSync(testFilePath, 'utf8');
    } catch (err) {
      console.error('Error reading test file:', err);
      if (err instanceof Error) {
        throw new Error(`Could not read test file: ${err.message}`);
      } else {
        throw new Error('Could not read test file: Unknown error');
      }
    }
    
    // Extract vulnerability type from filename
    const fileNameMatch = path.basename(testFilePath).match(/penetrationTest-[^-]+-(.+)\.ts$/);
    const vulnerabilityType = fileNameMatch ? fileNameMatch[1] : 'Unknown';
    
    const systemPrompt = `You are an expert in smart contract security and penetration testing. 
Your task is to analyze the results of a previous penetration test and create an improved version.

IMPORTANT CONTEXT:
1. The previous penetration test ${exploitSuccess ? 'successfully exploited' : 'FAILED to exploit'} the vulnerability
2. You are on attempt #${attemptNumber} of this penetration test
3. You are working with a Hardhat project structure
4. Your goal is to ${exploitSuccess ? 'make the exploit more efficient or reliable' : 'successfully exploit the vulnerability that the previous test missed'}

TECHNICAL REQUIREMENTS:
1. DO NOT create or use separate attacker contracts - your test must be self-contained
2. If you need attacker logic, define attack functions directly in the test
3. Use Hardhat ethers v6 syntax correctly (await contract.waitForDeployment(), await contract.getAddress())
4. Use await ethers.provider.getBalance() and ethers.parseEther() for ETH amounts
5. For reentrancy attacks, implement inline fallback functions using multiple signers

PREVIOUS TEST OUTPUT:
\`\`\`
${testOutput}
\`\`\`

PREVIOUS TEST CODE:
\`\`\`typescript
${testFileContent}
\`\`\`

INSTRUCTIONS:
1. Carefully analyze why the previous test ${exploitSuccess ? 'succeeded' : 'failed'}
2. ${exploitSuccess 
    ? 'Refine the successful approach to make it more efficient, reliable, or to extract more value from the exploit' 
    : 'Identify why the exploit failed and modify the approach to overcome those obstacles'}
3. Create a completely new test file that builds on what you learned
4. Keep using the same style (imports, structure) but improve the exploit logic
5. Focus on ${exploitSuccess ? 'optimization' : 'making the exploit work'} in this iteration
6. For reentrancy attacks, use a direct approach without an external attacker contract

Your adapted test must follow Hardhat conventions and not depend on any external contracts.`;

    const requestData: ChatCompletionRequestWithVenice = {
      model: "default",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Here's the smart contract I'm trying to exploit:
\`\`\`solidity
${contractCode}
\`\`\`

Please analyze the previous test results and create an improved test that targets the same vulnerability but with a ${exploitSuccess ? 'more optimized' : 'working'} exploit approach.`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      venice_parameters: {
        include_venice_system_prompt: false
      }
    };

    console.log("Making API request to Venice for improved test (attempt " + attemptNumber + ")");
    const response = await openai.createChatCompletion(requestData as any);
    
    if (!response?.data?.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from API - no content found");
    }

    // Get the generated test content
    const content = response.data.choices[0].message.content;
    console.log(`📥 Raw API response received with length: ${content.length} characters`);
    console.log(`Response content first 200 chars: ${content.substring(0, 200).replace(/\n/g, '\\n')}...`);
    
    // Extract the actual TypeScript code
    const codeMatch = content.match(/```typescript\n([\s\S]*?)\n```/) || 
                      content.match(/```ts\n([\s\S]*?)\n```/) || 
                      content.match(/```\n([\s\S]*?)\n```/);
                      
    let testCode = content;
    if (codeMatch && codeMatch[1]) {
      testCode = codeMatch[1];
    }
    
    // NEW: Validate and correct the test before saving
    console.log("🧪 Validating and correcting adapted penetration test...");
    try {
      const validationResult = await validateAndCorrectTest(
        testCode, 
        contractCode, 
        vulnerabilityType
      );
      
      if (validationResult.success && validationResult.correctedCode) {
        console.log("✅ Test validation and correction successful");
        testCode = validationResult.correctedCode;
      } else {
        console.warn("⚠️ Test validation failed, using original code:", validationResult.error);
      }
    } catch (validationError) {
      console.error("❌ Error during test validation:", validationError);
      // Continue with original code if validation fails
    }
    
    // Create a unique filename for the adapted test
    const timestamp = Date.now();
    // Extract just the basename without the path
    const originalBasename = path.basename(testFilePath);
    const newFilename = originalBasename.replace(/\.ts$/, `-adapted-${attemptNumber}-${timestamp}.ts`);

    // Save the test file
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      throw new Error("No workspace open");
    }

    const testDir = path.join(workspacePath, 'test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const filePath = path.join(testDir, newFilename);
    fs.writeFileSync(filePath, testCode);
    console.log(`💾 Full test code written to file (${testCode.length} characters)`);

    console.log(`✅ Adapted penetration test saved to ${filePath}`);
    
    return {
      success: true,
      filePath
    };
  } catch (error: any) {
    console.error("❌ Error adapting penetration test:", error);
    console.error("Error details:", error.stack || "No stack trace available");
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Validates and corrects a penetration test using Venice API
 * 
 * @param testCode The original test code that may have issues
 * @param contractCode The smart contract being tested
 * @param vulnerabilityType The type of vulnerability being tested
 * @returns Promise with corrected test code
 */
export const validateAndCorrectTest = async (
  testCode: string,
  contractCode: string,
  vulnerabilityType: string
): Promise<{success: boolean; correctedCode?: string; error?: string}> => {
  try {
    if (!process.env.REACT_APP_VENICE_API_KEY) {
      console.error("❌ Venice API key is not set");
      throw new Error("API key is not configured. Set REACT_APP_VENICE_API_KEY environment variable.");
    }

    console.log(`⭐ Validating and correcting penetration test for ${vulnerabilityType}`);
    
    // Extract contract name from the contract code
    const contractNameMatch = contractCode.match(/contract\s+(\w+)\s*{/);
    const contractName = contractNameMatch ? contractNameMatch[1] : 'Contract';
    console.log(`Detected contract name: ${contractName}`);
    
    const systemPrompt = `You are an expert in smart contract security testing with Hardhat. 
You're given a penetration test that may contain issues like external contract dependencies or syntax errors.
Your task is to correct the test and make it fully self-contained.

REQUIREMENTS FOR THE CORRECTED TEST:
1. MUST be self-contained (no external contract imports)
2. Use only these imports: ethers from hardhat, expect from chai
3. Use correct Hardhat ethers v6 syntax:
   - await contract.waitForDeployment() instead of .deployed()
   - await contract.getAddress() instead of .address
   - ethers.parseEther() instead of ethers.utils.parseEther()
   - Use BigInt (e.g., 0n) for number comparisons

4. CRITICAL: Use the EXACT contract name "${contractName}" when deploying:
   \`\`\`typescript
   // CORRECT:
   const ${contractName}Factory = await ethers.getContractFactory("${contractName}");
   const ${contractName.toLowerCase()} = await ${contractName}Factory.deploy();
   await ${contractName.toLowerCase()}.waitForDeployment();
   \`\`\`

5. DO NOT include the contract source code directly in the test file
   
6. If attack logic requires a separate contract:
   - Define it directly in the test using inline template strings with ethers
   \`\`\`typescript
   const AttackerFactory = await ethers.getContractFactory(\`
   contract Attacker {
     // Contract code here
   }
   \`);
   \`\`\`

7. Ensure the test logic is clear and correctly tests the ${vulnerabilityType} vulnerability

RESPOND WITH ONLY THE FULLY CORRECTED TEST CODE WITHOUT ANY EXPLANATIONS.
DO NOT include markdown formatting, just return valid TypeScript code.`;

    const requestData: ChatCompletionRequestWithVenice = {
      model: "default",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Here's a penetration test for a ${vulnerabilityType} vulnerability that needs validation and correction:

ORIGINAL TEST CODE:
\`\`\`typescript
${testCode}
\`\`\`

SMART CONTRACT BEING TESTED:
\`\`\`solidity
${contractCode}
\`\`\`

The test is encountering Hardhat artifacts errors. Please fix the test to correctly use the contract name "${contractName}" from my Hardhat project.
Return ONLY the corrected test code as plain text without any markdown or explanations.`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      venice_parameters: {
        include_venice_system_prompt: false
      }
    };

    console.log("📤 Making API request to validate and correct test");
    const response = await openai.createChatCompletion(requestData as any);
    
    if (!response?.data?.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from API - no content found");
    }

    // Get the corrected test content
    let correctedCode = response.data.choices[0].message.content;
    console.log(`📥 Received corrected test code (${correctedCode.length} characters)`);
    
    // Remove any markdown code blocks if present
    const codeMatch = correctedCode.match(/```typescript\n([\s\S]*?)\n```/) || 
                    correctedCode.match(/```ts\n([\s\S]*?)\n```/) || 
                    correctedCode.match(/```\n([\s\S]*?)\n```/);
                    
    if (codeMatch && codeMatch[1]) {
      correctedCode = codeMatch[1];
    }
    
    // Manual post-processing to fix common errors
    const contractNameRegex = new RegExp(`getContractFactory\\(["']([^"']+)["']\\)`, 'g');
    let match;
    const contractsReferenced = [];
    
    while ((match = contractNameRegex.exec(correctedCode)) !== null) {
      if (match[1] !== contractName && !match[1].includes('`')) {
        contractsReferenced.push(match[1]);
      }
    }
    
    // Manually fix any remaining incorrect contract references
    if (contractsReferenced.length > 0) {
      console.log(`⚠️ Found incorrect contract references: ${contractsReferenced.join(', ')}`);
      contractsReferenced.forEach(wrongName => {
        const replaceRegex = new RegExp(`getContractFactory\\(["']${wrongName}["']\\)`, 'g');
        correctedCode = correctedCode.replace(replaceRegex, `getContractFactory("${contractName}")`);
      });
      console.log("✅ Fixed incorrect contract references");
    }
    
    return {
      success: true,
      correctedCode
    };
  } catch (error: any) {
    console.error("❌ Error validating and correcting test:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generates a comprehensive security report based on penetration test results
 * 
 * @param contractCode The original smart contract code
 * @param contractName The name of the contract
 * @param testResults Array of test results with vulnerability details
 * @returns Promise with the report information
 */
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
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const reportDir = path.join(workspacePath, 'security-reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    // Change the file extension to .html
    const reportFilename = `${contractName}-SecurityReport-${timestamp}.html`;
    const filePath = path.join(reportDir, reportFilename);
    fs.writeFileSync(filePath, htmlReport);
    
    console.log(`✅ HTML security report saved to ${filePath}`);
    
    return {
      success: true,
      report: htmlReport,
      filePath
    };
  } catch (error: any) {
    console.error("❌ Error generating security report:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

