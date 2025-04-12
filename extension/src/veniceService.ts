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
    
    // Replace the systemPrompt in generatePenetrationTest with this improved version
    const systemPrompt = `You are an expert in smart contract security and penetration testing. 
Create a standalone TypeScript file that performs penetration testing on the provided smart contract.

IMPORTANT - Create a SELF-CONTAINED test file that works with Hardhat:

1. Use ONLY these imports:
   \`\`\`typescript
   import { ethers } from "hardhat";
   import { expect } from "chai";
   \`\`\`

2. DO NOT try to use a separate attacker contract. Instead:
   - Create attack functions directly in the test
   - Use multiple Hardhat signers (accounts) for different roles
   - Interact directly with the vulnerable contract

3. FOCUS on testing ONE specific vulnerability type per test:
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
  
  // Deploy all contracts needed for the test
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
2. DO NOT use ethers.utils (it's deprecated) - use ethers.parseEther() and similar
3. Call waitForDeployment() after deploying contracts
4. Ensure all contract function calls use the correct syntax for ethers v6
5. Ethers v6 uses BigInt for numbers - use 0n for zero and handle comparison appropriately

The focus should be on demonstrating how to exploit the vulnerability in the simplest way possible.`;

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

