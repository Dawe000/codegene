/**
 * Interface for Venice API request with chat completion parameters
 */
export interface ChatCompletionRequestWithVenice {
    model: string;
    messages: {
        role: string;
        content: string;
    }[];
    temperature: number;
    max_tokens: number;
    venice_parameters: {
        include_venice_system_prompt: boolean;
        [key: string]: any;
    };
}

/**
 * Interface for basic contract analysis result
 */
export interface ContractAnalysisResult {
    overall_score?: number;
    error?: string;
    raw_response?: string;
    complexity?: AnalysisCategory;
    vulnerabilities?: VulnerabilitiesCategory;
    upgradability?: AnalysisCategory;
    behavior?: AnalysisCategory;
}

/**
 * Interface for standard analysis category
 */
export interface AnalysisCategory {
    score?: number;
    details?: string[];
    risk_level?: 'Low' | 'Medium' | 'High';
}

/**
 * Interface for the vulnerabilities category which includes exploits
 */
export interface VulnerabilitiesCategory extends AnalysisCategory {
    exploits?: Exploit[];
}

/**
 * Interface for an exploit entry
 */
export interface Exploit {
    name: string;
    vulnerability_name?: string;
    description: string;
    severity: 'Low' | 'Medium' | 'High';
    mitigation: string;
}

/**
 * Interface for insurance assessment result
 */
export interface InsuranceAssessment {
    risk_score?: number;
    premium_percentage?: number;
    coverage_limit?: string;
    risk_factors?: string[];
    risk_level?: 'Low' | 'Medium' | 'High';
    policy_recommendations?: string[];
    exclusions?: string[];
    error?: string;
}

/**
 * Interface for hardhat service response
 */
export interface HardhatNodeResponse {
    success: boolean;
    message: string;
    contractAddresses?: string[];
    nodeUrl?: string;
}

/**
 * Interface for deployment information
 */
export interface DeploymentInfo {
    contractNames: string[];
    contractAddresses: {[name: string]: string};
    contractAbis: {[name: string]: any};
}

/**
 * Interface for Hardhat account
 */
export interface HardhatAccount {
    privateKey: string;
    address: string;
}

/**
 * Interface for node information
 */
export interface NodeInfo {
    url: string;
    accounts: HardhatAccount[];
    isRunning: boolean;
}

/**
 * Interface for contract information
 */
export interface ContractInfo {
    name: string;
    address: string;
    abi: any;
}

/**
 * Interface for deployment result
 */
export interface DeploymentResult {
    success: boolean;
    message: string;
    nodeInfo?: NodeInfo;
    contracts?: ContractInfo[];
}