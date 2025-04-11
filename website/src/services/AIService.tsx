//change it to whatever service we use later -> rn using venice
import { Configuration, OpenAIApi } from "openai";

// Define Venice-specific parameters type
interface VeniceParameters {
  include_venice_system_prompt: boolean;
}

// Configure OpenAI client with Venice base URL
const configuration = new Configuration({
  apiKey: process.env.REACT_APP_VENICE_API_KEY || "",
  basePath: "https://api.venice.ai/api/v1"
});

const openai = new OpenAIApi(configuration);

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
  try {
    console.log("API Key available:", !!process.env.REACT_APP_VENICE_API_KEY);
    
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

    const response = await openai.createChatCompletion(requestData as any);

    // Add null checks for response data
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
        overall_score: 50,
        complexity: {
          score: 50,
          details: ["Failed to parse structured analysis"],
          risk_level: "Medium"
        },
        vulnerabilities: {
          score: 50,
          details: [typeof content === 'string' ? content : "No analysis available"],
          risk_level: "Medium"
        },
        upgradability: {
          score: 50,
          details: ["Failed to parse structured analysis"],
          risk_level: "Medium"
        },
        behavior: {
          score: 50,
          details: ["Failed to parse structured analysis"],
          risk_level: "Medium"
        }
      };
    }
  } catch (error: any) {
    console.error('Error calling Venice API:', error);
    if (error.response?.data) {
      console.error('Error response:', error.response.data);
    }
    throw new Error('Failed to analyze contract. Please try again.');
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

export const generateCoinRecommendation = async (
    contractCode: string,
    analysis: any
  ): Promise<any> => {
    try {
      const requestData: ChatCompletionRequestWithVenice = {
        model: "default",
        messages: [
          {
            role: "system",
            content: `You are an expert in smart contract analysis and tokenomics. Based on the provided smart contract 
            analysis, generate recommendations for a tokenomics model that would be appropriate for this contract.
            Include suggested name, symbol, initial supply, and distribution strategy. The contract has a security score
            of ${analysis.overall_score}/100 and risk level of ${analysis.vulnerabilities.risk_level}.`
          },
          {
            role: "user",
            content: `Generate tokenomics recommendations for this contract:\n\n${contractCode}\n\nAnalysis: ${JSON.stringify(analysis)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        venice_parameters: {
          include_venice_system_prompt: false
        }
      };
  
      const response = await openai.createChatCompletion(requestData as any);
      const content = response?.data?.choices?.[0]?.message?.content ?? "";
      
      // Extract name and symbol from the AI response
      // This is a simplified approach - you'd need more sophisticated parsing
      const nameMatch = content.match(/name:?\s*["']?([\w\s]+)["']?/i);
      const symbolMatch = content.match(/symbol:?\s*["']?([\w\s]+)["']?/i);
      
      const securityLevel = analysis.overall_score > 80 ? 'Safe' : 
                           analysis.overall_score > 60 ? 'Secure' : 'Flex';
                           
      return {
        name: nameMatch ? nameMatch[1] : `CodeGene ${securityLevel} Token`,
        symbol: symbolMatch ? symbolMatch[1] : `CG${securityLevel.charAt(0)}`,
        recommendedText: content,
        initialSupply: analysis.overall_score > 80 ? 1000000 : 500000,
        // Other tokenomics parameters
        distribution: {
          team: 15,
          community: 40,
          treasury: 20,
          liquidity: 25
        }
      };
    } catch (error: any) {
      console.error('Error generating coin recommendation:', error);
      // Return fallback recommendations
      const securityLevel = analysis.overall_score > 80 ? 'Safe' : 
                           analysis.overall_score > 60 ? 'Secure' : 'Flex';
      return {
        name: `CodeGene ${securityLevel} Token`,
        symbol: `CG${securityLevel.charAt(0)}`,
        recommendedText: "Failed to generate AI recommendations.",
        initialSupply: 1000000,
        distribution: {
          team: 20,
          community: 40,
          treasury: 20,
          liquidity: 20
        }
      };
    }
  };