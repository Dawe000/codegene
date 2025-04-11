import * as React from 'react';
import { useState, useEffect } from 'react';
import { vscode } from './vscodeApi'; // Import from the shared file

import ExploitCode from './ExploitCode';

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
  selected: boolean;
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

const HardhatInstructions: React.FC = () => {
  const [showInstructions, setShowInstructions] = useState(false);
  
  return (
    <div className="mb-6 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
      <div 
        className="bg-gradient-to-r from-slate-800 to-slate-800/50 px-6 py-4 border-b border-slate-700/50 flex items-center justify-between cursor-pointer"
        onClick={() => setShowInstructions(!showInstructions)}
      >
        <span className="text-sm font-medium flex items-center gap-2">
          <span className="text-cyan-400">🛠️</span> Hardhat Test Environment Setup
        </span>
        <span>{showInstructions ? '▼' : '▶'}</span>
      </div>
      
      {showInstructions && (
        <div className="p-6">
          <p className="text-sm text-slate-300 mb-4">
            To run the exploit tests, you'll need a Hardhat environment. Follow these steps:
          </p>
          
          <ol className="space-y-3 text-sm text-slate-300 list-decimal pl-5">
            <li>
              <p>Create a new directory for your Hardhat project:</p>
              <pre className="bg-slate-900 p-3 rounded-lg mt-2 text-xs">mkdir exploit-test && cd exploit-test</pre>
            </li>
            <li>
              <p>Initialize a new npm project and install Hardhat:</p>
              <pre className="bg-slate-900 p-3 rounded-lg mt-2 text-xs">npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox</pre>
            </li>
            <li>
              <p>Initialize Hardhat:</p>
              <pre className="bg-slate-900 p-3 rounded-lg mt-2 text-xs">npx hardhat init</pre>
              <p className="mt-2">Select "Create a JavaScript project" when prompted.</p>
            </li>
            <li>
              <p>Copy the vulnerable smart contract to the <code className="bg-slate-800 px-2 py-0.5 rounded">contracts/</code> directory.</p>
            </li>
            <li>
              <p>Save the exploit test file to the <code className="bg-slate-800 px-2 py-0.5 rounded">test/</code> directory.</p>
            </li>
            <li>
              <p>Run the test:</p>
              <pre className="bg-slate-900 p-3 rounded-lg mt-2 text-xs">npx hardhat test</pre>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
};

const App: React.FC<AppProps> = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCount, setSelectedCount] = useState<number>(0);

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'displayFiles':
          setIsLoading(false);
          setFiles(message.files.map((file: string) => ({
            name: file,
            selected: false,
            isAnalysisResult: false
          })));
          setSelectedCount(0);
          break;

        case 'displayAnalysis':
          setIsLoading(false);
          setAnalysis(message.analysis);
          setFiles(prev => [
            ...prev,
            {
              name: `Analysis complete for: ${message.fileName || 'Selected files'}`,
              selected: false,
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
              selected: false,
              isAnalysisResult: true
            }
          ]);
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const toggleFileSelection = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (!newFiles[index].isAnalysisResult) {
        newFiles[index].selected = !newFiles[index].selected;
        setSelectedCount(
          newFiles.filter(file => file.selected && !file.isAnalysisResult).length
        );
      }
      return newFiles;
    });
  };

  const analyzeSelectedFiles = () => {
    const selectedFiles = files.filter(file => file.selected && !file.isAnalysisResult);
    
    if (selectedFiles.length === 0) {
      vscode.postMessage({
        command: 'showInfo',
        text: 'Please select at least one file to analyze'
      });
      return;
    }

    vscode.postMessage({
      command: 'analyzeSelectedFiles',
      fileNames: selectedFiles.map(file => file.name)
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
              <ul className="space-y-3 mb-6">
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
              <p className="text-sm text-slate-500 italic mb-6">No details available</p>
            )}
            
            {/* Add the exploit code section */}
            <h6 className="font-medium text-sm text-red-400 mb-3">Vulnerability Exploits</h6>
            {data.exploits && data.exploits.length > 0 ? (
              <div className="space-y-2">
                <div className="bg-slate-800 p-3 rounded-lg mb-4 text-xs text-slate-400">
                  <p className="font-medium mb-1">About these exploit files:</p>
                  <p>Each exploit comes with a complete Hardhat test file that demonstrates the vulnerability. 
                  You can download and run these tests in a Hardhat environment to understand the security risks.</p>
                </div>
                {data.exploits.map((exploit: any, i: number) => (
                  <ExploitCode key={i} exploit={exploit} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No exploit code generated</p>
            )}

            {/* Add a download all button if there are multiple exploits */}
            {data.exploits && data.exploits.length > 1 && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    vscode.postMessage({
                      command: 'downloadAllExploits',
                      exploits: data.exploits,
                      vulnerabilityType: title
                    });
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-md text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-cyan-500/20 transition-all"
                >
                  <span>⬇️</span> Download All Exploits As One File
                </button>
              </div>
            )}
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

      {/* Files Section */}
      {files.length > 0 && (
        <div className="mb-8 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50">
          <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 px-6 py-4 rounded-t-xl border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <span className="text-cyan-400">📁</span> Available Files
            </span>
            <button
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 transform hover:scale-105 
                ${selectedCount === 0 
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40'}`}
              onClick={analyzeSelectedFiles}
              disabled={selectedCount === 0}
            >
              {selectedCount === 0 ? 'Select Files' : `Analyze Selected (${selectedCount})`}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto p-4 space-y-1">
            {files.map((file, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg cursor-pointer transition-all duration-300 
                  ${file.selected 
                    ? 'bg-cyan-500/10 border border-cyan-500/20' 
                    : 'hover:bg-slate-700/50 border border-transparent'}`}
                onClick={() => toggleFileSelection(index)}
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

      {/* Hardhat Instructions */}
      {analysis && analysis.vulnerabilities && analysis.vulnerabilities.exploits && analysis.vulnerabilities.exploits.length > 0 && (
        <HardhatInstructions />
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <h4 className="text-xl font-bold text-slate-200">Analysis Results</h4>
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
    </div>
  );
};

export default App;