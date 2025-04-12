import * as React from 'react';
import { useState, useEffect } from 'react';
import { vscode } from './vscodeApi'; // Import from the shared file

// Change this import to use the renamed component
import VulnerabilityCard from './VulnerabilityCard';

interface AppProps {
  vscode: any;
}

const RiskBadge: React.FC<{ level: string }> = ({ level }) => {
  const getColor = () => {
    switch (level) {
      case 'Low': return 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50';
      case 'Medium': return 'bg-amber-500/30 text-amber-400 border border-amber-500/50';
      case 'High': return 'bg-red-500/30 text-red-400 border border-red-500/50';
      default: return 'bg-slate-500/30 text-slate-400 border border-slate-500/50';
    }
  };

  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getColor()} backdrop-blur-sm`}>
      {level}
    </span>
  );
};

const ScoreIndicator: React.FC<{ score: number }> = ({ score }) => {
  const getColor = () => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-full bg-slate-700/50 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${getColor()} transition-all duration-500 ease-out`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-medium text-slate-300 tabular-nums">{score}</span>
    </div>
  );
};

interface FileItem {
  name: string;
  path: string; // Added path property to store full file path
  isAnalysisResult: boolean;
}

const LoadingPulse: React.FC = () => (
  <div className="flex gap-1">
    {[...Array(3)].map((_, i) => (
      <div
        key={i}
        className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse"
        style={{ animationDelay: `${i * 150}ms` }}
      />
    ))}
  </div>
);

const HardhatControls: React.FC<{ isProjectDetected: boolean }> = ({ isProjectDetected }) => {
  const [nodeStatus, setNodeStatus] = useState<'stopped' | 'running' | 'starting'>('stopped');
  const [contractAddresses, setContractAddresses] = useState<string[]>([]);
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.command === 'hardhatNodeStarted') {
        setNodeStatus('running');
        if (message.contractAddresses) {
          setContractAddresses(message.contractAddresses);
        }
      } else if (message.command === 'hardhatNodeStopped') {
        setNodeStatus('stopped');
        setContractAddresses([]);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  if (!isProjectDetected) {
    return null;
  }
  
  return (
    <div className="mb-6 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2">
          <span className="text-cyan-400">⚙️</span> Hardhat Node Controls
        </span>
      </div>
      
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              nodeStatus === 'running' ? 'bg-emerald-500 animate-pulse' : 
              nodeStatus === 'starting' ? 'bg-amber-500 animate-pulse' : 
              'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium">
              {nodeStatus === 'running' ? 'Node Running' : 
               nodeStatus === 'starting' ? 'Starting Node...' : 
               'Node Stopped'}
            </span>
          </div>
          
          <div className="flex gap-2">
            {nodeStatus === 'stopped' && (
              <button
                onClick={() => {
                  setNodeStatus('starting');
                  vscode.postMessage({
                    command: 'startNodeAndDeploy'
                  });
                }}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-md text-sm font-medium flex items-center gap-2 hover:shadow-lg hover:shadow-cyan-500/20 transition-all"
              >
                <span>▶️</span> Start Node & Deploy
              </button>
            )}
            
            {nodeStatus === 'running' && (
              <button
                onClick={() => {
                  vscode.postMessage({
                    command: 'stopNode'
                  });
                }}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-amber-500 text-white rounded-md text-sm font-medium flex items-center gap-2 hover:shadow-lg hover:shadow-red-500/20 transition-all"
              >
                <span>⏹️</span> Stop Node
              </button>
            )}
          </div>
        </div>
        
        {nodeStatus === 'running' && contractAddresses.length > 0 && (
          <div className="mt-4">
            <h5 className="text-sm font-medium text-slate-400 mb-2">Deployed Contracts:</h5>
            <div className="bg-slate-900/50 p-4 rounded-lg max-h-32 overflow-y-auto">
              {contractAddresses.map((address, i) => (
                <div key={i} className="text-sm text-slate-300 mb-1 font-mono">
                  {address}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {nodeStatus === 'running' && (
          <div className="mt-4 text-sm bg-slate-900/50 p-3 rounded-lg text-slate-400">
            <span className="font-medium">JSON-RPC Endpoint:</span> http://localhost:8545
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC<AppProps> = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [projectDetected, setProjectDetected] = useState<boolean>(false);
  const [projectInfo, setProjectInfo] = useState<{path: string, contractCount: number} | null>(null);
  const [penetrationTestResult, setPenetrationTestResult] = useState<{
    success: boolean;
    exploitSuccess?: boolean;
    securityImplication?: string;
    output: string;
    filePath: string;
  } | null>(null);
  const [multipleTestResults, setMultipleTestResults] = useState<{
    vulnerability: string;
    filePath: string;
    success?: boolean;
    exploitSuccess?: boolean;
    securityImplication?: string;
    output?: string;
  }[] | null>(null);

  // Add these state variables at the top of your component
  const [activeTab, setActiveTab] = useState<'single' | 'multiple'>('multiple');
  const [expandedTests, setExpandedTests] = useState<number[]>([]);
  const [sortOption, setSortOption] = useState<string>('severity');

  // Add this function to handle expanding/collapsing test results
  const toggleExpandedTest = (index: number) => {
    if (expandedTests.includes(index)) {
      setExpandedTests(expandedTests.filter(i => i !== index));
    } else {
      setExpandedTests([...expandedTests, index]);
    }
  };

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'displayFiles':
          setIsLoading(false);
          // Update to handle Hardhat project information
          if (message.isHardhatProject) {
            setProjectDetected(true);
            setProjectInfo({
              path: message.projectPath || 'Unknown',
              contractCount: message.files.length
            });
          }
          
          setFiles(message.files.map((file: {name: string, path: string}) => ({
            name: file.name,
            path: file.path,
            isAnalysisResult: false
          })));
          break;

        case 'displayAnalysis':
          setIsLoading(false);
          setAnalysis(message.analysis);
          setFiles(prev => [
            ...prev,
            {
              name: `Analysis complete for: ${message.fileName || 'Contracts'}`,
              path: '',
              isAnalysisResult: true
            }
          ]);
          break;

        case 'startLoading':
          setIsLoading(true);
          break;

        case 'displayExploit':
          setIsLoading(false);
          // Create a simple analysis structure focusing only on the exploit
          setAnalysis({
            overall_score: message.exploit.severity === 'High' ? 20 : 
                           message.exploit.severity === 'Medium' ? 50 : 80,
            vulnerabilities: {
              score: message.exploit.severity === 'High' ? 20 : 
                     message.exploit.severity === 'Medium' ? 50 : 80,
              risk_level: message.exploit.severity,
              details: [message.exploit.description],
              exploits: [message.exploit]
            }
          });
          setFiles(prev => [
            ...prev,
            {
              name: `Exploit generated for: ${message.vulnerabilityType}`,
              path: '',
              isAnalysisResult: true
            }
          ]);
          break;

        case 'displayPenetrationTestResult':
          setIsLoading(false);
          setPenetrationTestResult({
            success: message.success,
            exploitSuccess: message.exploitSuccess,
            securityImplication: message.securityImplication,
            output: message.output,
            filePath: message.filePath
          });
          // Clear multiple results when showing a single result
          setMultipleTestResults(null);
          // Make sure we're showing the single test tab
          setActiveTab('single');
          break;
        
        case 'displayMultiplePenetrationTestResults':
          setIsLoading(false);
          setMultipleTestResults(message.testResults);
          // Clear single result when showing multiple results
          setPenetrationTestResult(null);
          // Make sure we're showing the multiple tests tab
          setActiveTab('multiple');
          // Auto-expand first test with security issues
          const exploitableIndex = message.testResults.findIndex((t: any) => t.exploitSuccess);
          if (exploitableIndex >= 0) {
            setExpandedTests([exploitableIndex]);
          } else if (message.testResults.length > 0) {
            setExpandedTests([0]); // Expand first test if no exploitable ones
          }
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  // Function to trigger analysis of all contracts
  const analyzeAllContracts = () => {
    vscode.postMessage({
      command: 'analyzeAllContracts'
    });
  };



  const renderCategorySection = (title: string, data: any) => {
    if (!data) {
      return (
        <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-transparent rounded-xl" />
          <h5 className="relative font-semibold text-lg text-slate-400">{title}</h5>
          <p className="relative mt-4 text-sm text-slate-500">No {title.toLowerCase()} data available</p>
        </div>
      );
    }

    // Special handling for vulnerabilities with exploits
    if (title === 'Vulnerabilities' && data && data.exploits && data.exploits.length > 0) {
      return (
        <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-transparent rounded-xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <h4 className="text-lg font-semibold text-white">Vulnerabilities Found</h4>
              <RiskBadge level={data.risk_level} />
              <ScoreIndicator score={data.score} />
            </div>

            {/* Display vulnerability details */}
            <div className="space-y-6">
              {data.details && data.details.map((detail: string, index: number) => (
                <div key={index} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-sm text-slate-300">{detail}</p>
                </div>
              ))}
              
              {/* Update to use the renamed VulnerabilityCard component */}
              {data.exploits && data.exploits.map((vulnerability: any, index: number) => (
                <VulnerabilityCard key={index} vulnerability={vulnerability} />
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-transparent rounded-xl" />
        
        <div className="relative flex items-center justify-between mb-4">
          <h5 className="font-semibold text-lg text-slate-200">{title}</h5>
          {data.risk_level && <RiskBadge level={data.risk_level} />}
        </div>

        {typeof data.score === 'number' && (
          <div className="relative mb-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-slate-400">Score</span>
              <ScoreIndicator score={data.score} />
            </div>
          </div>
        )}

        <div className="relative mt-4">
          <h6 className="font-medium text-sm text-slate-400 mb-3">Findings</h6>
          {data.details && data.details.length > 0 ? (
            <ul className="space-y-3">
              {data.details.map((detail: string, i: number) => (
                <li 
                  key={i} 
                  className="p-4 bg-slate-900/50 rounded-lg border-l-2 border-cyan-500/50 text-sm text-slate-300 leading-relaxed hover:bg-slate-900/80 transition-colors duration-300"
                >
                  {detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 italic">No details available</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold flex items-center gap-3 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          <span className="text-2xl">⚡</span>
          Smart Contract Analysis
        </h3>

        {isLoading && (
          <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700/50">
            <span className="text-sm text-slate-400">Processing</span>
            <LoadingPulse />
          </div>
        )}
      </div>

      {/* Project Info Section - Simplified without file paths */}
      {projectDetected ? (
        <div className="mb-8 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50">
          <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 px-6 py-4 rounded-t-xl border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <span className="text-cyan-400">📁</span> Hardhat Project Detected
            </span>
            <div className="flex gap-2">
              <button
                className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 transform hover:scale-105 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40"
                onClick={analyzeAllContracts}
              >
                Analyze All Contracts
              </button>
              
              {/* Only show penetration test button after analysis */}
              {analysis && analysis.vulnerabilities && analysis.vulnerabilities.exploits && (
                <button
                  className="bg-gradient-to-r from-red-500 to-amber-500 text-white px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 transform hover:scale-105 shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
                  onClick={() => {
                    vscode.postMessage({
                      command: 'generateAndRunMultipleTests',
                      vulnerabilities: analysis.vulnerabilities.exploits
                    });
                  }}
                >
                  Test {analysis.vulnerabilities.exploits.length} Vulnerabilities
                </button>
              )}
            </div>
          </div>
          <div className="p-4">
            <div className="bg-slate-900/50 p-4 rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Contracts Found:</span>
                <span className="text-slate-300 font-medium">{projectInfo?.contractCount || 0}</span>
              </div>
            </div>
            
            {/* Contracts List - Simplified without paths */}
            {files.length > 0 && (
              <div className="mt-4">
                <h5 className="text-sm font-medium text-slate-400 mb-2">Contracts:</h5>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {files.filter(f => !f.isAnalysisResult).map((file, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-slate-700/50 border border-transparent"
                    >
                      <div className="flex items-center text-slate-300">
                        <span className="mr-2 text-slate-500">📄</span>
                        <span className="font-medium">{file.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-8 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50">
          <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 px-6 py-4 rounded-t-xl border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <span className="text-cyan-400">📁</span> Available Files
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto p-4 space-y-1">
            {files.map((file, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg cursor-pointer transition-all duration-300 
                  ${file.isAnalysisResult 
                    ? 'bg-cyan-500/10 border border-cyan-500/20' 
                    : 'hover:bg-slate-700/50 border border-transparent'}`}
              >
                {file.isAnalysisResult ? (
                  <div className="flex items-center text-emerald-400">
                    <span className="mr-2">✓</span>
                    <span className="font-medium">{file.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center text-slate-300">
                    <span className="mr-2 text-slate-500">📄</span>
                    <span>{file.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hardhat Controls */}
      <HardhatControls isProjectDetected={projectDetected} />

      {/* Analysis Results */}
      {analysis && (
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <h4 className="text-xl font-bold text-slate-200">Analysis Results</h4>
            {analysis.offline_mode && (
              <div className="px-3 py-1 bg-amber-500/30 text-amber-400 border border-amber-500/50 rounded-full text-xs">
                Offline Mode
              </div>
            )}
            {typeof analysis.overall_score === 'number' && (
              <div className="flex items-center bg-slate-800/50 backdrop-blur-sm py-2 px-6 rounded-full border border-slate-700/50">
                <span className="mr-3 text-slate-400">Overall Score</span>
                <span className={`text-2xl font-bold ${
                  analysis.overall_score >= 80 ? 'text-emerald-400' :
                  analysis.overall_score >= 50 ? 'text-amber-400' :
                  'text-red-400'
                }`}>
                  {analysis.overall_score}
                </span>
              </div>
            )}
          </div>

          {analysis.error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
              <div className="flex items-center text-red-400 text-lg font-medium mb-2">
                <span className="mr-2">⚠️</span>
                Error Occurred
              </div>
              <div className="text-red-300">{analysis.error}</div>
              {analysis.error_info && (
                <div className="mt-4 text-amber-400 text-sm">
                  <strong>Details:</strong> {analysis.error_info}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderCategorySection('Vulnerabilities', analysis.vulnerabilities)}
              {renderCategorySection('Complexity', analysis.complexity)}
              {renderCategorySection('Upgradability', analysis.upgradability)}
              {renderCategorySection('Behavior', analysis.behavior)}
            </div>
          )}
        </div>
      )}

      {/* ===== SECURITY TESTING SECTION ===== */}
      {(penetrationTestResult || (multipleTestResults && multipleTestResults.length > 0)) && (
        <div className="mb-8 mt-8 border-t border-slate-700 pt-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-200 mb-2">Security Testing Results</h2>
            <p className="text-slate-400 text-sm">
              Smart contract penetration tests to assess exploitability of potential vulnerabilities
            </p>
          </div>
          
          {/* Tab navigation for single vs multiple tests */}
          {penetrationTestResult && multipleTestResults && multipleTestResults.length > 0 && (
            <div className="flex border-b border-slate-700 mb-6">
              <button 
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'single' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400'}`}
                onClick={() => setActiveTab('single')}
              >
                Individual Test
              </button>
              <button 
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'multiple' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400'}`}
                onClick={() => setActiveTab('multiple')}
              >
                Vulnerability Tests ({multipleTestResults.length})
              </button>
            </div>
          )}
          
          {/* Single test result */}
          {penetrationTestResult && (!multipleTestResults || activeTab === 'single') && (
            <div className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border ${
              penetrationTestResult.exploitSuccess 
                ? 'border-red-700/50' 
                : 'border-emerald-700/50'
            } overflow-hidden mb-6`}>
              <div className={`px-6 py-4 border-b ${
                penetrationTestResult.exploitSuccess 
                  ? 'border-red-700/50 bg-gradient-to-r from-red-500/20 to-red-500/5' 
                  : 'border-emerald-700/50 bg-gradient-to-r from-emerald-500/20 to-emerald-500/5'
              } flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  {penetrationTestResult.exploitSuccess 
                    ? <span className="text-red-400">⚠️</span> 
                    : <span className="text-emerald-400">✅</span>}
                  <span className="font-semibold">
                    {penetrationTestResult.exploitSuccess 
                      ? 'Vulnerability Exploited' 
                      : 'Contract Protected'}
                  </span>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs ${
                  penetrationTestResult.exploitSuccess 
                    ? 'bg-red-500/30 text-red-300 border border-red-500/50' 
                    : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                }`}>
                  {penetrationTestResult.exploitSuccess ? 'Security Risk' : 'Secure'}
                </div>
              </div>
              
              {penetrationTestResult.securityImplication && (
                <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/80">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Security Implication</h4>
                  <p className="text-slate-400 text-sm">{penetrationTestResult.securityImplication}</p>
                </div>
              )}
              
              <div className="p-6">
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 max-h-80 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-slate-300 text-xs font-mono overflow-x-auto">
                    {penetrationTestResult.output}
                  </pre>
                </div>
                
                <div className="mt-4 flex justify-end">
                  <button
                    className="px-4 py-2 bg-slate-700/50 text-slate-300 rounded-md text-sm font-medium hover:bg-slate-700"
                    onClick={() => {
                      vscode.postMessage({
                        command: 'openFile',
                        path: penetrationTestResult.filePath
                      });
                    }}
                  >
                    View Test File
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Multiple test results */}
          {multipleTestResults && multipleTestResults.length > 0 && (!penetrationTestResult || activeTab === 'multiple') && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2 items-center">
                  <div className="text-sm px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full text-red-300">
                    {multipleTestResults.filter(t => t.exploitSuccess).length} Exploitable
                  </div>
                  <div className="text-sm px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 rounded-full text-emerald-300">
                    {multipleTestResults.filter(t => !t.exploitSuccess).length} Protected
                  </div>
                </div>
                <div className="flex gap-2">
                  <select 
                    className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-3 py-1 text-sm"
                    onChange={(e) => setSortOption(e.target.value)}
                    value={sortOption}
                  >
                    <option value="severity">Sort by Severity</option>
                    <option value="exploitable">Exploitable First</option>
                    <option value="protected">Protected First</option>
                  </select>
                </div>
              </div>
            
              {multipleTestResults
                .sort((a, b) => {
                  if (sortOption === 'exploitable') return a.exploitSuccess ? -1 : 1;
                  if (sortOption === 'protected') return a.exploitSuccess ? 1 : -1;
                  return 0; // Default or severity
                })
                .map((result, index) => (
                  <div 
                    key={index} 
                    className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border ${
                      result.exploitSuccess 
                        ? 'border-red-700/50' 
                        : 'border-emerald-700/50'
                    } overflow-hidden transition-all duration-200`}
                  >
                    <div 
                      className={`px-6 py-4 border-b ${
                        result.exploitSuccess 
                          ? 'border-red-700/50 bg-gradient-to-r from-red-500/20 to-red-500/5' 
                          : 'border-emerald-700/50 bg-gradient-to-r from-emerald-500/20 to-emerald-500/5'
                      } flex items-center justify-between cursor-pointer`}
                      onClick={() => toggleExpandedTest(index)}
                    >
                      <div className="flex items-center gap-2">
                        {result.exploitSuccess 
                          ? <span className="text-red-400">⚠️</span> 
                          : <span className="text-emerald-400">✅</span>}
                        <span className="font-semibold">{result.vulnerability}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 rounded-full text-xs ${
                          result.exploitSuccess 
                            ? 'bg-red-500/30 text-red-300 border border-red-500/50' 
                            : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                        }`}>
                          {result.exploitSuccess ? 'Exploitable' : 'Protected'}
                        </div>
                        <span className="text-slate-400 text-lg">
                          {expandedTests.includes(index) ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>
                    
                    {expandedTests.includes(index) && (
                      <>
                        {result.securityImplication && (
                          <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/80">
                            <h4 className="text-sm font-medium text-slate-300 mb-2">Security Implication</h4>
                            <p className="text-slate-400 text-sm">{result.securityImplication}</p>
                          </div>
                        )}
                        
                        <div className="p-6">
                          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 max-h-60 overflow-y-auto">
                            <pre className="whitespace-pre-wrap text-slate-300 text-xs font-mono overflow-x-auto">
                              {result.output?.substring(0, 800) || 'No output available'}
                              {result.output && result.output.length > 800 ? '...' : ''}
                            </pre>
                          </div>
                          
                          <div className="mt-4 flex justify-end">
                            <button
                              className="px-4 py-2 bg-slate-700/50 text-slate-300 rounded-md text-sm font-medium hover:bg-slate-700"
                              onClick={() => {
                                vscode.postMessage({
                                  command: 'openFile',
                                  path: result.filePath
                                });
                              }}
                            >
                              View Test File
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Multiple Penetration Test Results */}
      {multipleTestResults && multipleTestResults.length > 0 && (
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <h4 className="text-xl font-bold text-slate-200">Vulnerability Penetration Tests</h4>
            <div className="px-3 py-1 bg-slate-800/50 rounded-full text-xs">
              {multipleTestResults.filter(t => t.success).length}/{multipleTestResults.length} Exploited
            </div>
          </div>
          
          <div className="space-y-4">
            {multipleTestResults.map((result, index) => (
              <div key={index} className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
                <div className={`px-6 py-4 border-b border-slate-700/50 flex items-center justify-between ${
                  result.success 
                    ? 'bg-gradient-to-r from-red-500/20 to-red-500/5' 
                    : 'bg-gradient-to-r from-slate-800 to-slate-800/50'
                }`}>
                  <div className="flex items-center gap-2">
                    {result.success 
                      ? <span className="text-red-400">⚠️</span> 
                      : <span className="text-slate-400">🛡️</span>}
                    <span className="font-semibold">{result.vulnerability}</span>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs ${
                    result.success 
                      ? 'bg-red-500/30 text-red-400 border border-red-500/50' 
                      : 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                  }`}>
                    {result.success ? 'Exploitable' : 'Protected'}
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 max-h-32 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-slate-300 text-xs font-mono">
                      {result.output?.substring(0, 300) || 'No output available'}
                      {result.output && result.output.length > 300 ? '...' : ''}
                    </pre>
                  </div>
                  
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      className="px-4 py-2 bg-slate-700/50 text-slate-300 rounded-md text-sm font-medium"
                      onClick={() => {
                        vscode.postMessage({
                          command: 'openFile',
                          path: result.filePath
                        });
                      }}
                    >
                      View Test
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Penetration Test Results */}
      {penetrationTestResult && (
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <h4 className="text-xl font-bold text-slate-200">Penetration Test Results</h4>
            <div className={`px-3 py-1 rounded-full text-xs ${
              penetrationTestResult.success 
                ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50' 
                : 'bg-red-500/30 text-red-400 border border-red-500/50'
            }`}>
              {penetrationTestResult.success ? 'Test Passed' : 'Test Failed'}
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h5 className="text-lg font-semibold text-white mb-4">Test Output</h5>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-slate-300 text-sm font-mono">
                {penetrationTestResult.output || 'No output available'}
              </pre>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-md text-sm font-medium"
                onClick={() => {
                  vscode.postMessage({
                    command: 'openFile',
                    path: penetrationTestResult.filePath
                  });
                }}
              >
                Open Test File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;