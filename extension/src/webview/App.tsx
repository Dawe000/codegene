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
  path: string;
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
    attemptNumber?: number;
    failureAnalysis?: {
      isSecure: boolean;
      explanation: string;
      suggestedFix?: string;
    };
  }[] | null>(null);

  const [expandedTests, setExpandedTests] = useState<number[]>([]);
  const [sortOption, setSortOption] = useState<string>('severity');

  const [adaptedTestResults, setAdaptedTestResults] = useState<{
    attemptNumber: number;
    success: boolean;
    exploitSuccess?: boolean;
    securityImplication?: string;
    output: string;
    filePath: string;
    previousFilePath?: string;
  }[]>([]);

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
      console.log("Received message:", message);

      switch (message.command) {
        case 'startLoading':
          setIsLoading(true);
          break;

        case 'stopLoading':
          setIsLoading(false);
          break;

        case 'displayFiles':
          setIsLoading(false);
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

        case 'displayExploit':
          setIsLoading(false);
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
          setMultipleTestResults(null);
          break;
        
        case 'displayMultiplePenetrationTestResults':
          setIsLoading(false);
          setMultipleTestResults(message.testResults);
          setPenetrationTestResult(null);
          const exploitableIndex = message.testResults.findIndex((t: any) => t.exploitSuccess);
          if (exploitableIndex >= 0) {
            setExpandedTests([exploitableIndex]);
          } else if (message.testResults.length > 0) {
            setExpandedTests([0]);
          }
          break;

        case 'displayAdaptedPenetrationTestResult':
          setIsLoading(false);
          
          // Debug logs to verify message data
          console.log('🔍 Adaptation result received:', {
            attemptNumber: message.attemptNumber,
            exploitSuccess: message.exploitSuccess,
            filePath: message.filePath,
            output: message.output?.substring(0, 100) + '...' // Log just the beginning of output
          });
          
          // Force update adaptedTestResults with functional update
          setAdaptedTestResults(currentResults => {
            const newResult = {
              attemptNumber: message.attemptNumber || 0,
              success: message.success || false,
              exploitSuccess: message.exploitSuccess || false,
              securityImplication: message.securityImplication || '',
              output: message.output || '',
              filePath: message.filePath || '',
              previousFilePath: message.previousFilePath || ''
            };
            
            console.log('📊 Current adaptedTestResults count:', currentResults.length);
            console.log('➕ Adding new result to adaptedTestResults');
            
            // Return a new array to ensure React detects the change
            return [...currentResults, newResult];
          });
          
          break;

        case 'penetrationTestResult':
          setIsLoading(false);
          setPenetrationTestResult({
            success: message.success,
            exploitSuccess: message.exploitSuccess,
            securityImplication: message.securityImplication,
            output: message.output,
            filePath: message.filePath
          });
          // Do NOT clear adaptedTestResults here
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  // Debug effect to monitor state changes
  useEffect(() => {
    console.log("adaptedTestResults updated:", adaptedTestResults);
  }, [adaptedTestResults]);

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

            <div className="space-y-6">
              {data.details && data.details.map((detail: string, index: number) => (
                <div key={index} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-sm text-slate-300">{detail}</p>
                </div>
              ))}
              
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

      {(penetrationTestResult || (multipleTestResults && multipleTestResults.length > 0)) && (
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <h4 className="text-xl font-bold text-slate-200">Penetration Test Results</h4>
            
            {multipleTestResults && multipleTestResults.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-full p-1 border border-slate-700/50 flex items-center text-xs">
                <span className="text-slate-400 ml-2 mr-2">Sort by:</span>
                <button
                  className={`px-3 py-1 rounded-full ${sortOption === 'severity' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                  onClick={() => setSortOption('severity')}
                >
                  Severity
                </button>
                <button
                  className={`px-3 py-1 rounded-full ${sortOption === 'success' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                  onClick={() => setSortOption('success')}
                >
                  Exploitable
                </button>
              </div>
            )}
          </div>

          {penetrationTestResult && (
            <div className="space-y-4 mb-8">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
                <div className={`p-6 ${
                  penetrationTestResult.exploitSuccess 
                    ? 'bg-red-500/10 border-b border-red-500/20' 
                    : 'bg-emerald-500/10 border-b border-emerald-500/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h5 className="text-lg font-semibold text-white">Test Results</h5>
                        <span className={`text-sm px-3 py-1 rounded-full ${
                          penetrationTestResult.exploitSuccess 
                            ? 'bg-red-500/30 text-red-400 border border-red-500/50' 
                            : 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                        }`}>
                          {penetrationTestResult.exploitSuccess ? 'Vulnerability Exploited' : 'Test Failed'}
                        </span>
                      </div>
                      
                      {penetrationTestResult.securityImplication && (
                        <div className="mb-4 p-4 bg-slate-900/50 rounded-lg text-sm text-slate-300">
                          <strong className="text-white">Vulnerability:</strong> {penetrationTestResult.securityImplication}
                        </div>
                      )}
                    </div>
                    
                    <button
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Retry clicked once for:', penetrationTestResult.filePath);
                        vscode.postMessage({
                          command: 'adaptPenetrationTest',
                          testFilePath: penetrationTestResult.filePath,
                          exploitSuccess: penetrationTestResult.exploitSuccess || false
                        });
                      }}
                    >
                      {penetrationTestResult.exploitSuccess ? 'Optimize Exploit' : 'Retry Exploit'}
                    </button>
                  </div>
                </div>
                
                <div className="p-6">
                  <h6 className="font-medium text-sm text-slate-400 mb-3">Test Output</h6>
                  <pre className="bg-slate-900/50 text-slate-300 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {penetrationTestResult.output}
                  </pre>
                </div>
              </div>
              
              {/* Show adaptation history if available */}
              {adaptedTestResults.length > 0 && (
                <div className="mt-4 pl-8 border-l-2 border-cyan-500/30">
                  <h5 className="text-md font-semibold text-slate-300 mb-4">
                    Adaptation History ({adaptedTestResults.length} attempts)
                  </h5>
                  
                  <div className="space-y-4">
                    {adaptedTestResults.map((result, index) => (
                      <div 
                        key={index} 
                        className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden ${
                          result.exploitSuccess ? 'ring-1 ring-red-500' : ''
                        }`}
                      >
                        <div className={`p-4 ${
                          result.exploitSuccess 
                            ? 'bg-red-500/10 border-b border-red-500/20' 
                            : 'bg-emerald-500/10 border-b border-emerald-500/20'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <h5 className="text-md font-semibold text-white">Attempt #{result.attemptNumber}</h5>
                                <span className={`text-xs px-3 py-1 rounded-full ${
                                  result.exploitSuccess 
                                    ? 'bg-red-500/30 text-red-400 border border-red-500/50' 
                                    : 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                                }`}>
                                  {result.exploitSuccess ? 'Exploit Successful' : 'Exploit Failed'}
                                </span>
                              </div>
                              
                              {result.securityImplication && (
                                <div className="mb-4 p-3 bg-slate-900/50 rounded-lg text-sm text-slate-300">
                                  <strong className="text-white">Vulnerability:</strong> {result.securityImplication}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <details>
                            <summary className="cursor-pointer text-sm text-slate-400 mb-2">View Test Output</summary>
                            <pre className="bg-slate-900/50 text-slate-300 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto mt-2">
                              {result.output}
                            </pre>
                          </details>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {multipleTestResults && multipleTestResults.length > 0 && (
            <div className="space-y-4">
              {multipleTestResults
                .sort((a, b) => {
                  if (sortOption === 'severity') {
                    return a.vulnerability.localeCompare(b.vulnerability);
                  } else {
                    return (b.exploitSuccess ? 1 : 0) - (a.exploitSuccess ? 1 : 0);
                  }
                })
                .map((test, index) => (
                  <div key={index} className="space-y-4">
                    <div 
                      className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden ${
                        test.exploitSuccess ? 'ring-1 ring-red-500' : ''
                      }`}
                    >
                      <div className={`p-6 ${
                        test.exploitSuccess 
                          ? 'bg-red-500/10 border-b border-red-500/20' 
                          : 'bg-slate-700/30 border-b border-slate-600/20'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h5 className="text-lg font-semibold text-white">{test.vulnerability}</h5>
                              <span className={`text-sm px-3 py-1 rounded-full ${
                                test.exploitSuccess 
                                  ? 'bg-red-500/30 text-red-400 border border-red-500/50' 
                                  : 'bg-slate-500/30 text-slate-400 border border-slate-500/50'
                              }`}>
                                {test.exploitSuccess ? 'Exploitable' : 'Not Exploitable'}
                              </span>
                            </div>
                            
                            {test.securityImplication && (
                              <div className="mb-4 p-4 bg-slate-900/50 rounded-lg text-sm text-slate-300">
                                <strong className="text-white">Vulnerability:</strong> {test.securityImplication}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              className="bg-slate-700 text-slate-300 p-2 rounded-full text-xs transition-all duration-300 hover:bg-slate-600"
                              onClick={() => toggleExpandedTest(index)}
                            >
                              {expandedTests.includes(index) ? '▼ Hide' : '▶ Show'} Details
                            </button>
                            
                            <button
                              className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20"
                              onClick={() => {
                                vscode.postMessage({
                                  command: 'adaptPenetrationTest',
                                  testFilePath: test.filePath,
                                  exploitSuccess: test.exploitSuccess || false
                                });
                              }}
                            >
                              {test.exploitSuccess ? 'Optimize Exploit' : 'Retry Exploit'}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {expandedTests.includes(index) && test.output && (
                        <div className="p-6">
                          <h6 className="font-medium text-sm text-slate-400 mb-3">Test Output</h6>
                          <pre className="bg-slate-900/50 text-slate-300 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {test.output}
                          </pre>
                          
                          {/* Display failure analysis if test failed and analysis is available */}
                          {!test.exploitSuccess && test.failureAnalysis && (
                            <div className={`mt-4 p-4 rounded-lg border ${
                              test.failureAnalysis.isSecure 
                                ? 'bg-green-900/20 border-green-700/30 text-green-300' 
                                : 'bg-amber-900/20 border-amber-700/30 text-amber-300'
                            }`}>
                              <h6 className="font-medium text-sm mb-2">
                                {test.failureAnalysis.isSecure 
                                  ? '🛡️ Contract Successfully Protected Against Attack' 
                                  : '⚠️ Test Implementation Issue Detected'}
                              </h6>
                              
                              <div className="text-xs space-y-2">
                                <div><strong>Analysis:</strong> {test.failureAnalysis.explanation}</div>
                                {test.failureAnalysis.suggestedFix && (
                                  <div><strong>Suggested Fix:</strong> {test.failureAnalysis.suggestedFix}</div>
                                )}
                              </div>
                              
                              {test.failureAnalysis.isSecure && (
                                <div className="mt-3 inline-block px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs">
                                  This contract appears to be secure against {test.vulnerability} attacks
                                </div>
                              )}
                              
                              {!test.failureAnalysis.isSecure && (
                                <button
                                  className="mt-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20"
                                  onClick={() => {
                                    vscode.postMessage({
                                      command: 'adaptPenetrationTest',
                                      testFilePath: test.filePath,
                                      exploitSuccess: false
                                    });
                                  }}
                                >
                                  Fix Test Implementation
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          <button 
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed mt-4 w-full sm:w-auto"
            onClick={() => vscode.postMessage({ command: 'generateSecurityReport' })}
            disabled={!multipleTestResults || multipleTestResults.length === 0}
          >
            <span className="flex items-center justify-center">
              <svg className="w-3 h-3 mr-2" width="50px" height="50px" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Generate Security Report
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;