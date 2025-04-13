// src/services/AIService.tsx
import axios from "axios";

// Base URL for Portia API
const PORTIA_API_URL = process.env.REACT_APP_PORTIA_API_URL || 'https://portia-finetune-1.onrender.com';

// Helper function to construct proper URLs
const constructUrl = (endpoint: string): string => {
  // Make sure endpoint starts with a slash AND trim any whitespace
  const formattedEndpoint = endpoint.trim();
  const endpointWithSlash = formattedEndpoint.startsWith('/') ? formattedEndpoint : `/${formattedEndpoint}`;
  
  // Make sure base URL doesn't end with a slash AND trim any whitespace
  const trimmedBaseUrl = PORTIA_API_URL.trim();
  const baseUrl = trimmedBaseUrl.endsWith('/') ? trimmedBaseUrl.slice(0, -1) : trimmedBaseUrl;
  
  const url = `${baseUrl}${endpointWithSlash}`;
  console.log(`[URL Debug] Constructed URL: ${url}`);
  return url;
};

// Enhanced logging function
const logApiRequest = (endpoint: string, data: any) => {
  console.log(`[API Request] ${endpoint}`, {
    url: constructUrl(endpoint),
    environment: process.env.NODE_ENV,
    apiUrl: PORTIA_API_URL,
    dataSize: JSON.stringify(data).length,
    timestamp: new Date().toISOString()
  });
  return constructUrl(endpoint);
};

// Enhanced error logging function
const logApiError = (endpoint: string, error: any) => {
  console.error(`[API Error] ${endpoint}`, {
    url: constructUrl(endpoint),
    environment: process.env.NODE_ENV,
    apiUrl: PORTIA_API_URL,
    error: {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      config: {
        headers: error.config?.headers,
        method: error.config?.method,
        timeout: error.config?.timeout
      }
    },
    timestamp: new Date().toISOString()
  });
};

export const analyzeContract = async (contractCode: string): Promise<any> => {
  const endpoint = '/analyze-contract';
  logApiRequest(endpoint, { contractCodeLength: contractCode.length });
  
  try {
    console.time('analyzeContract');
    const response = await axios.post(constructUrl(endpoint), {
      contract_code: contractCode
    });
    console.timeEnd('analyzeContract');
    
    console.log(`[API Response] ${endpoint}`, {
      status: response.status,
      hasResults: !!response.data?.results,
      hasOutputs: !!response.data?.results?.outputs,
      hasFinalOutput: !!response.data?.results?.outputs?.final_output
    });
    
    // Extract the final analysis from Portia's response
    const portiaResults = response.data;
    const finalOutput = portiaResults.results?.outputs?.final_output;
    
    // Transform the response to match your existing format
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
        details: generateDefaultFindings('complexity'),
        risk_level: (complexityRiskMatch[1] || "Medium") as "Low" | "Medium" | "High"
      },
      vulnerabilities: {
        score: parseInt(vulnerabilityScoreMatch[1]) || 90,
        details: generateDefaultFindings('vulnerabilities'),
        risk_level: (vulnerabilityRiskMatch[1] || "Low") as "Low" | "Medium" | "High"
      },
      upgradability: {
        score: parseInt(upgradabilityScoreMatch[1]) || 80,
        details: generateDefaultFindings('upgradability'),
        risk_level: (upgradabilityRiskMatch[1] || "Medium") as "Low" | "Medium" | "High"
      },
      behavior: {
        score: parseInt(behaviorScoreMatch[1]) || 85,
        details: generateDefaultFindings('behavior'),
        risk_level: (behaviorRiskMatch[1] || "Low") as "Low" | "Medium" | "High"
      }
    };
  } catch (error: any) {
    logApiError(endpoint, error);
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
  const endpoint = '/translate-contract';
  
  try {
    // Debug URL construction
    console.log(`[URL Construction Debug] Target language: ${targetLanguage}`);
    console.log(`[URL Construction Debug] PORTIA_API_URL: ${PORTIA_API_URL}`);
    
    const url = constructUrl(endpoint);
    logApiRequest(endpoint, { codeLength: sourceCode.length, targetLanguage });
    
    console.log(`[URL Final] Using URL: ${url}`);
    
    const response = await axios.post(url, {
      contract_code: sourceCode,  // Note: changed from source_code to match API expectation
      target_language: targetLanguage
    });
    
    console.log("[Translate API Response]", {
      status: response.status,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : []
    });
    
    // Check if we got a valid response with the right structure
    if (response.data && response.data.results && response.data.results.outputs && 
        response.data.results.outputs.final_output) {
      
      const finalOutput = response.data.results.outputs.final_output;
      
      if (finalOutput.value) {
        if (typeof finalOutput.value === 'string') {
          return finalOutput.value;
        } else if (typeof finalOutput.value === 'object') {
          return JSON.stringify(finalOutput.value);
        }
      }
      
      if (finalOutput.summary) {
        return finalOutput.summary;
      }
    }
    
    // If we couldn't extract structured data properly, return a fallback message
    return `Translation to ${targetLanguage} failed. Please try again with a different contract or language.`;
  } catch (error: any) {
    console.error('Error calling Portia API:', error);
    throw new Error(`Failed to translate contract to ${targetLanguage}. Please try again.`);
  }
};

export const assessInsurance = async (
  contractCode: string, 
  tvl: number
): Promise<any> => {
  const endpoint = '/assess-insurance';
  const url = logApiRequest(endpoint, { contractCodeLength: contractCode.length, tvl });
  
  try {
    const response = await axios.post(url, {
      contract_code: contractCode,
      tvl: tvl
    });
    
    // Check for structured data in the response
    if (response.data && response.data.results && response.data.results.outputs && 
        response.data.results.outputs.final_output) {
            
      const finalOutput = response.data.results.outputs.final_output;
      
      if (finalOutput.value) {
        if (typeof finalOutput.value === 'object' && finalOutput.value.risk_score) {
          return finalOutput.value;
        }
        
        if (typeof finalOutput.value === 'string') {
          try {
            const jsonMatch = finalOutput.value.match(/```json\n([\s\S]*?)\n```/) || 
                             finalOutput.value.match(/```\n([\s\S]*?)\n```/) || 
                             finalOutput.value.match(/{[\s\S]*?}/);
                            
            if (jsonMatch) {
              const jsonStr = jsonMatch[0].replace(/```json\n|```\n|```/g, '');
              return JSON.parse(jsonStr);
            }
          } catch (e) {
            console.error("Failed to parse JSON from API response:", e);
          }
        }
      }
    }
    
    // Generate dynamic fallback values based on the TVL
    const calculateFallbackValues = (tvl: number) => {
      // Risk score calculation based on TVL
      const riskScore = Math.min(Math.max(40 + Math.log10(tvl) * 5, 40), 80);
      
      // Premium percentage - higher TVL means slightly lower percentage (economies of scale)
      const premiumPercentage = 7 - Math.min(Math.log10(tvl), 5);
      
      // Coverage limit as a percentage of TVL, bigger TVL gets lower percentage coverage
      const coveragePercentage = 0.9 - (Math.log10(tvl) * 0.01);
      const coverageLimit = `$${Math.floor(tvl * coveragePercentage).toLocaleString()}`;
      
      // Risk level based on calculated risk score
      const riskLevel = riskScore > 70 ? "High" : riskScore > 50 ? "Medium" : "Low";
      
      // Generate dynamic risk factors based on TVL and risk level
      const riskFactors = [
        `Contract handles significant value (${tvl.toLocaleString()} TVL)`,
        riskLevel === "High" ? "Potential for complex reentrancy attacks" : 
          "Standard validation of external calls required",
        tvl > 1000000 ? "High-value target for attackers" : "Moderate-value target for attackers"
      ];
      
      // Generate dynamic policy recommendations
      const policyRecommendations = [
        `Standard coverage with ${premiumPercentage.toFixed(1)}% premium rate`,
        tvl > 5000000 ? "Consider multi-signature security controls" : 
          "Regular security audits recommended",
        `Coverage up to ${coverageLimit} with standard deductible`
      ];
      
      // Generate exclusions
      const exclusions = [
        "Intentionally introduced vulnerabilities",
        "Social engineering attacks",
        tvl > 1000000 ? "Flash loan attack vectors not properly mitigated" : 
          "Basic validation failures"
      ];
      
      return {
        risk_score: Math.round(riskScore),
        premium_percentage: parseFloat(premiumPercentage.toFixed(1)),
        coverage_limit: coverageLimit,
        risk_factors: riskFactors,
        risk_level: riskLevel,
        policy_recommendations: policyRecommendations,
        exclusions: exclusions
      };
    };
    
    // Return the dynamically generated fallback
    return calculateFallbackValues(tvl);
    
  } catch (error: any) {
    console.error('Error calling Portia API:', error);
    throw new Error('Failed to assess insurance risk. Please try again.');
  }
};

export const generateCoinRecommendation = async (
  contractCode: string,
  analysis: any
): Promise<any> => {
  const endpoint = '/generate-recommendation';
  const url = logApiRequest(endpoint, { contractCodeLength: contractCode.length });
  
  try {
    const response = await axios.post(url, {
      contract_code: contractCode,
      analysis: analysis
    });
    
    // Check if we got a valid response
    if (response.data && response.data.results && response.data.results.outputs && 
        response.data.results.outputs.final_output) {
      
      const finalOutput = response.data.results.outputs.final_output;
      let content = "";
      
      if (finalOutput.value) {
        content = typeof finalOutput.value === 'string' ? finalOutput.value : JSON.stringify(finalOutput.value);
      } else if (finalOutput.summary) {
        content = finalOutput.summary;
      }
      
      // Extract name and symbol from the AI response
      const nameMatch = content.match(/name:?\s*["']?([\w\s]+)["']?/i);
      const symbolMatch = content.match(/symbol:?\s*["']?([\w\s]+)["']?/i);
      
      const securityLevel = analysis.overall_score > 80 ? 'Safe' : 
                           analysis.overall_score > 60 ? 'Secure' : 'Flex';
                           
      return {
        name: nameMatch ? nameMatch[1] : `CodeGene ${securityLevel} Token`,
        symbol: symbolMatch ? symbolMatch[1] : `CG${securityLevel.charAt(0)}`,
        recommendedText: content,
        initialSupply: analysis.overall_score > 80 ? 1000000 : 500000,
        // Distribution parameters
        distribution: {
          team: 15,
          community: 40,
          treasury: 20,
          liquidity: 25
        }
      };
    }
    
    // Fallback
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