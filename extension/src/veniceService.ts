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
        // The request was made but no response was received
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

