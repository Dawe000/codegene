import * as React from 'react';
import { useState, useEffect } from 'react';

interface AppProps {
  vscode: any;
}

// Risk level badge component
const RiskBadge: React.FC<{ level: string }> = ({ level }) => {
  const getColor = () => {
    switch (level) {
      case 'Low': return 'bg-green-500 text-white';
      case 'Medium': return 'bg-yellow-500 text-black';
      case 'High': return 'bg-red-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getColor()} ml-2`}>
      {level}
    </span>
  );
};

// Score indicator component
const ScoreIndicator: React.FC<{ score: number }> = ({ score }) => {
  const getColor = () => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center">
      <div className="w-full bg-gray-300 rounded-full h-2.5 mr-2">
        <div
          className={`h-2.5 rounded-full ${getColor()}`}
          style={{ width: `${score}%` }}
        ></div>
      </div>
      <span className="text-sm font-medium">{score}</span>
    </div>
  );
};

interface FileItem {
  name: string;
  selected: boolean;
  isAnalysisResult: boolean;
}

const App: React.FC<AppProps> = ({ vscode }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCount, setSelectedCount] = useState<number>(0);

  // Message handler for receiving data from extension
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === 'displayFiles') {
        setIsLoading(false);
        const newFiles = message.files.map((file: string) => ({
          name: file,
          selected: false,
          isAnalysisResult: false
        }));
        setFiles(newFiles);
        setSelectedCount(0);
      }

      if (message.command === 'displayAnalysis') {
        setIsLoading(false);
        setAnalysis(message.analysis);
        // Add analysis result message without clearing existing files
        setFiles(prev => [
          ...prev, 
          {
            name: `Analysis complete for: ${message.fileName || 'Selected files'}`,
            selected: false,
            isAnalysisResult: true
          }
        ]);
      }

      if (message.command === 'startLoading') {
        setIsLoading(true);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  // Toggle file selection
  const toggleFileSelection = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      // Only toggle if it's not an analysis result
      if (!newFiles[index].isAnalysisResult) {
        newFiles[index].selected = !newFiles[index].selected;
        setSelectedCount(
          newFiles.filter(file => file.selected && !file.isAnalysisResult).length
        );
      }
      return newFiles;
    });
  };

  // Analyze selected files
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
      fileNames: selectedFiles.map(file => file.name)  // ✅ FIXED: Using "fileNames" key
    });
  };

  // Render detailed findings
  const renderDetailItem = (detail: string) => (
    <li className="py-1 pl-3 border-l-2 border-blue-500 text-gray-700 my-1">
      {detail}
    </li>
  );

  // Render category section of analysis results
  const renderCategorySection = (title: string, data: any) => {
    // If no data is provided, render an empty box with a message
    if (!data) {
      return (
        <div className="mb-5 bg-white shadow-md rounded-lg p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <h5 className="font-semibold text-lg mb-3 text-gray-800 border-b pb-2">{title}</h5>
          <p className="text-sm text-gray-500 italic p-2">No {title.toLowerCase()} data available</p>
        </div>
      );
    }

    return (
      <div className="mb-5 bg-white shadow-md rounded-lg p-6 border border-gray-200 hover:shadow-lg transition-shadow">
        {/* Title and Risk Badge */}
        <div className="flex items-center justify-between mb-3 border-b pb-3">
          <h5 className="font-semibold text-lg text-gray-800">{title}</h5>
          {data.risk_level && <RiskBadge level={data.risk_level} />}
        </div>

        {/* Score Indicator with improved spacing */}
        {typeof data.score === 'number' && (
          <div className="mb-5 bg-gray-50 p-3 rounded-md">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Score: </span>
              <ScoreIndicator score={data.score} />
            </div>
          </div>
        )}

        {/* Details with improved styling */}
        <div className="mt-4">
          <h6 className="font-medium text-sm text-gray-700 mb-2">Findings:</h6>
          {data.details && data.details.length > 0 ? (
            <ul className="mt-2 space-y-3 text-sm text-gray-700">
              {data.details.map((detail: string, i: number) => (
                <li key={i} className="py-2 px-4 bg-gray-50 rounded-md border-l-4 border-blue-500 leading-relaxed hover:bg-gray-100 transition-colors">
                  {detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 italic p-2">No details available</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 text-gray-900 bg-gray-50 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-300">
        <h3 className="text-xl font-bold flex items-center">
          <span className="mr-2">📊</span> Smart Contract Analysis
        </h3>

        {isLoading && (
          <div className="flex items-center">
            <div className="animate-pulse rounded-full h-2 w-2 bg-blue-500 mr-1"></div>
            <div className="animate-pulse rounded-full h-2 w-2 bg-blue-500 mr-1" style={{ animationDelay: '0.2s' }}></div>
            <div className="animate-pulse rounded-full h-2 w-2 bg-blue-500" style={{ animationDelay: '0.4s' }}></div>
          </div>
        )}
      </div>

      {/* Files Section */}
      {files.length > 0 && (
        <div className="mb-6 bg-white shadow rounded-md overflow-hidden border border-gray-200">
          <div className="bg-blue-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-between">
            <span>📁 Available Files</span>
            <button
              className="bg-green-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-600 transition-colors"
              onClick={analyzeSelectedFiles}
              disabled={selectedCount === 0}
            >
              Analyze Selected ({selectedCount})
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto p-3 text-sm">
            {files.map((file, index) => (
              <div
                key={index}
                className={`py-1 px-2 hover:bg-gray-100 rounded cursor-pointer transition-colors ${
                  file.selected ? 'bg-blue-100' : ''
                }`}
                onClick={() => toggleFileSelection(index)}
              >
                {file.isAnalysisResult ? (
                  <div className="flex items-center text-green-600">
                    <span className="mr-1">✓</span> {file.name}
                  </div>
                ) : (
                  <div>{file.name}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Results Section */}
      {analysis && (
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-medium text-lg">Analysis Results</h4>
            {typeof analysis.overall_score === 'number' && (
              <div className="flex items-center bg-white py-1 px-3 rounded-full shadow border border-gray-200">
                <span className="mr-2 font-medium">Overall Score:</span>
                <span className={`text-lg font-bold ${
                  analysis.overall_score >= 80 ? 'text-green-600' :
                  analysis.overall_score >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {analysis.overall_score}
                </span>
              </div>
            )}
          </div>

          {analysis.error ? (
            <div className="text-red-600 bg-red-50 p-4 rounded-md border border-red-300 shadow">
              <div className="font-medium text-lg mb-1">Error Occurred</div>
              <div>{analysis.error}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Always render all four categories */}
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