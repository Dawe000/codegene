// src/services/veniceService.ts
import { Configuration, OpenAIApi } from "openai";
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables directly in this file
const envPath = path.resolve(__dirname, '..', '.env');
console.log(`🔍 Loading .env file from: ${envPath}`);
const dotenvResult = dotenv.config({ path: envPath });

if (dotenvResult.error) {
  console.error('❌ Error loading .env file:', dotenvResult.error);
} else {
  console.log('✅ Loaded .env file successfully', dotenvResult.parsed ? Object.keys(dotenvResult.parsed).length : 0, 'variables');
}

// Add these lines near the top of the file
console.log("Process env keys:", Object.keys(process.env).filter(key => key.startsWith('REACT_APP')));
console.log("Full Venice API key length:", process.env.REACT_APP_VENICE_API_KEY?.length || 0);
console.log("Venice API key first 5 chars:", process.env.REACT_APP_VENICE_API_KEY?.substring(0, 5) || 'Not set');

// Define Venice-specific parameters type
interface VeniceParameters {
  include_venice_system_prompt: boolean;
}

console.log(process.env.REACT_APP_VENICE_API_KEY);

// Log environment variables (but hide most of API key for security)
console.log("Environment variables:", {
  REACT_APP_VENICE_API_KEY: process.env.REACT_APP_VENICE_API_KEY ? 
    `${process.env.REACT_APP_VENICE_API_KEY.substring(0, 3)}...${process.env.REACT_APP_VENICE_API_KEY.substring(process.env.REACT_APP_VENICE_API_KEY.length - 3)}` : 
    'Not set'
});

// Configure OpenAI client with Venice base URL
const configuration = new Configuration({
  apiKey: process.env.REACT_APP_VENICE_API_KEY || "",
  basePath: "https://api.venice.ai/api/v1"
});

console.log("OpenAI configuration initialized:", {
  basePath: configuration.basePath,
  
  apiKeySet: !!configuration.apiKey,
  apiKeyLength: typeof configuration.apiKey === "string" ? configuration.apiKey.length : 0
});

const openai = new OpenAIApi(configuration);
console.log("OpenAI client instance created");

// Type for the request including Venice parameters
interface ChatCompletionRequestWithVenice {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  venice_parameters?: VeniceParameters;
}

export const analyzeContract = async (contractCode: string): Promise<any> => {
  console.log("⭐ analyzeContract called with code length:", contractCode.length);
  console.log("⭐ First 100 chars of contract:", contractCode.substring(0, 100).replace(/\n/g, "\\n"));
  
  try {
    console.log("API Key available:", !!process.env.REACT_APP_VENICE_API_KEY);
    console.log("API Key length:", process.env.REACT_APP_VENICE_API_KEY?.length || 0);
    
    // Check if API key is set
    if (!process.env.REACT_APP_VENICE_API_KEY) {
      console.error("❌ Venice API key is not set");
      return { error: "API key is not configured. Set REACT_APP_VENICE_API_KEY environment variable." };
    }
    
    const requestData: ChatCompletionRequestWithVenice = {
      model: "default", // Venice will map this to an appropriate model
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
              "risk_level": "Low", "Medium", or "High"
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
      max_tokens: 3000,
      venice_parameters: {
        include_venice_system_prompt: false
      }
    };

    console.log("📤 Making API request to Venice with configuration:", {
      model: requestData.model,
      messageCount: requestData.messages.length,
      systemPromptLength: requestData.messages[0].content.length,
      temperature: requestData.temperature,
      max_tokens: requestData.max_tokens,
      venice_parameters: requestData.venice_parameters
    });

    // Actually make the API call
    console.log("⏳ Sending API request...");
    const startTime = Date.now();
    const response = await openai.createChatCompletion(requestData as any);
    const duration = Date.now() - startTime;
    console.log(`✅ API response received in ${duration}ms`);
    
    // Log basic response info
    console.log("API response status:", response.status);
    console.log("API response headers:", response.headers);

    // Add null checks for response data
    if (!response?.data) {
      console.error("❌ No data in API response");
      throw new Error("No data received from API");
    }
    
    console.log("API response data structure:", {
      choices: response.data.choices ? response.data.choices.length : "none",
      model: response.data.model,
      object: response.data.object,
      usage: response.data.usage
    });

    if (!response?.data?.choices?.[0]?.message?.content) {
      console.error("❌ Invalid response structure:", JSON.stringify(response.data, null, 2));
      throw new Error("Invalid response from API - no content found");
    }

    // Parse the response content as JSON
    try {
      const content = response.data.choices[0].message.content;
      console.log("📥 Raw API response content (first 100 chars):", content.substring(0, 100));
      
      // Try to detect if the response is already JSON or wrapped in markdown
      let jsonContent = content;
      
      // If response is wrapped in markdown code blocks, extract it
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                      content.match(/```\n([\s\S]*?)\n```/);
      
      if (jsonMatch) {
        console.log("📋 Detected JSON inside markdown code block");
        jsonContent = jsonMatch[1];
      }
      
      console.log("📋 Attempting to parse response as JSON");
      const parsedResult = JSON.parse(jsonContent);
      console.log("✅ Successfully parsed response");
      
      // Log the structure of the parsed result
      console.log("Parsed result structure:", Object.keys(parsedResult));
      return parsedResult;
    } catch (parseError) {
      console.error("❌ Failed to parse API response as JSON:", parseError);
      console.error("Raw content that failed to parse:", response.data.choices[0].message.content);
      return {
        error: "Failed to parse analysis results",
        raw_response: response.data.choices[0].message.content
      };
    }
  } catch (error: any) {
    console.error("❌ Error in analyzeContract:", error);
    
    // Log more detailed error information
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error("No response received for request:", error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Error message:", error.message);
    }
    
    return {
      error: `Failed to analyze contract. Please check your API key and network connection. ${error.message}`
    };
  }
};

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

    const response = await openai.createChatCompletion(requestData as any);

    // Add null check for response data
    if (!response?.data?.choices?.[0]?.message?.content) {
      return 'Failed to translate contract. No response from API.';
    }

    return response.data.choices[0].message.content;
  } catch (error: any) {
    console.error('Error calling Venice API:', error);
    throw new Error(`Failed to translate contract to ${targetLanguage}. Please try again.`);
  }
};

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
    console.error('Error calling Venice API:', error);
    throw new Error('Failed to assess insurance risk. Please try again.');
  }
};