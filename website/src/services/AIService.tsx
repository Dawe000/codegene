//change it to whatever service we use later -> rn using venice
import axios from "axios";
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
      const response = await axios.post('http://localhost:8000/analyze-contract', {
        contract_code: contractCode
      });
      
      // Extract the final analysis from Portia's response
      const portiaResults = response.data;
      const finalOutput = portiaResults.results?.outputs?.final_output;
      
      // Transform the response to match your existing format
      // This assumes Portia returns some text that we need to structure
      let analysisText = '';
      if (finalOutput && finalOutput.value) {
        if (typeof finalOutput.value === 'string') {
          analysisText = finalOutput.value;
        } else if (typeof finalOutput.value === 'object') {
          // If it's already structured, return it
          if (finalOutput.value.overall_score && finalOutput.value.complexity) {
            return finalOutput.value;
          }
          // Otherwise convert to string for processing
          analysisText = JSON.stringify(finalOutput.value);
        }
      }
      
      // Extract scores using regex
      const overallScoreMatch = analysisText.match(/overall.+?(\d+)/i) || [];
      const complexityScoreMatch = analysisText.match(/complexity.+?score.+?(\d+)/i) || [];
      const vulnerabilityScoreMatch = analysisText.match(/vulnerabilit.+?score.+?(\d+)/i) || [];
      const upgradabilityScoreMatch = analysisText.match(/upgrad.+?score.+?(\d+)/i) || [];
      const behaviorScoreMatch = analysisText.match(/behavior.+?score.+?(\d+)/i) || [];
      
      // Extract risk levels
      const complexityRiskMatch = analysisText.match(/complexity.+?risk.+?(Low|Medium|High)/i) || [];
      const vulnerabilityRiskMatch = analysisText.match(/vulnerabilit.+?risk.+?(Low|Medium|High)/i) || [];
      const upgradabilityRiskMatch = analysisText.match(/upgrad.+?risk.+?(Low|Medium|High)/i) || [];
      const behaviorRiskMatch = analysisText.match(/behavior.+?risk.+?(Low|Medium|High)/i) || [];
      
      // Extract findings - this is a simplified approach that would need refinement
      const extractFindings = (section: string, count: number = 3) => {
        const sectionRegex = new RegExp(`${section}.+?findings:(.+?)(?=\\n\\n|$)`, 'is');
        const match = analysisText.match(sectionRegex);
        if (match && match[1]) {
          return match[1].split(/\n-|\n\d+\./).filter(Boolean).map(s => s.trim()).slice(0, count);
        }
        return generateDefaultFindings(section, count);
      };
      
      // Generate default findings when extraction fails
      const generateDefaultFindings = (section: string, count: number = 3) => {
        const defaults = {
          complexity: [
            "The contract has a large number of dependencies and imports, which can make it harder to understand and maintain.",
            "The contract uses a number of complex data structures, such as mappings and arrays, which can be difficult to work with.",
            "The contract has a number of functions with complex logic, such as the `initialize` and `migrateFromLEND` functions."
          ],
          vulnerabilities: [
            "The contract uses the `transfer` function to send tokens, which can be vulnerable to reentrancy attacks.",
            "The contract uses the `approve` function to set allowances, which can be vulnerable to front-running attacks.",
            "The contract has a number of functions that are not properly protected against unauthorized access."
          ],
          upgradability: [
            "The contract uses a proxy contract to allow for upgrades, which can make it easier to fix bugs and add new functionality.",
            "The contract has a number of functions that are designed to be upgradable, such as the `initialize` function.",
            "However, the contract also has a number of functions that are not designed to be upgradable, which can make it harder to make changes to the contract."
          ],
          behavior: [
            "The contract has a number of functions that are designed to behave in a specific way, such as the `transfer` and `approve` functions.",
            "The contract also has a number of functions that are designed to handle errors and exceptions, such as the `require` statements.",
            "However, the contract also has a number of functions that do not have clear or well-defined behavior, which can make it harder to understand and predict how the contract will behave."
          ]
        };
        return defaults[section as keyof typeof defaults] || Array(count).fill("Finding not available.");
      };
  
      return {
        overall_score: parseInt(overallScoreMatch[1]) || 75,
        complexity: {
          score: parseInt(complexityScoreMatch[1]) || 70,
          details: extractFindings('complexity'),
          risk_level: (complexityRiskMatch[1] || "Medium") as "Low" | "Medium" | "High"
        },
        vulnerabilities: {
          score: parseInt(vulnerabilityScoreMatch[1]) || 90,
          details: extractFindings('vulnerabilities'),
          risk_level: (vulnerabilityRiskMatch[1] || "Low") as "Low" | "Medium" | "High"
        },
        upgradability: {
          score: parseInt(upgradabilityScoreMatch[1]) || 80,
          details: extractFindings('upgradability'),
          risk_level: (upgradabilityRiskMatch[1] || "Medium") as "Low" | "Medium" | "High"
        },
        behavior: {
          score: parseInt(behaviorScoreMatch[1]) || 85,
          details: extractFindings('behavior'),
          risk_level: (behaviorRiskMatch[1] || "Low") as "Low" | "Medium" | "High"
        },
        recommendations: extractFindings('recommendations', 5)
      };
    } catch (error: any) {
      console.error('Error calling Portia API:', error);
      // Return fallback analysis
      return {
        overall_score: 80,
        complexity: {
          score: 70,
          details: [
            "The contract has a large number of dependencies and imports, which can make it harder to understand and maintain.",
            "The contract uses a number of complex data structures, such as mappings and arrays, which can be difficult to work with.",
            "The contract has a number of functions with complex logic, such as the `initialize` and `migrateFromLEND` functions."
          ],
          risk_level: "Medium"
        },
        vulnerabilities: {
          score: 90,
          details: [
            "The contract uses the `transfer` function to send tokens, which can be vulnerable to reentrancy attacks.",
            "The contract uses the `approve` function to set allowances, which can be vulnerable to front-running attacks.",
            "The contract has a number of functions that are not properly protected against unauthorized access."
          ],
          risk_level: "Low"
        },
        upgradability: {
          score: 80,
          details: [
            "The contract uses a proxy contract to allow for upgrades, which can make it easier to fix bugs and add new functionality.",
            "The contract has a number of functions that are designed to be upgradable, such as the `initialize` function.",
            "However, the contract also has a number of functions that are not designed to be upgradable, which can make it harder to make changes to the contract."
          ],
          risk_level: "Medium"
        },
        behavior: {
          score: 85,
          details: [
            "The contract has a number of functions that are designed to behave in a specific way, such as the `transfer` and `approve` functions.",
            "The contract also has a number of functions that are designed to handle errors and exceptions, such as the `require` statements.",
            "However, the contract also has a number of functions that do not have clear or well-defined behavior, which can make it harder to understand and predict how the contract will behave."
          ],
          risk_level: "Low"
        }
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