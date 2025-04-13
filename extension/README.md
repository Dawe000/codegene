# CodeGene: AI-Powered Smart Contract Security

## 🛡️ Smart Contract Auditing and Penetration Testing

CodeGene brings AI-powered security analysis directly into your development workflow, automatically identifying vulnerabilities and generating targeted penetration tests for Solidity and Rust smart contracts.

## ✨ How It Works

CodeGene seamlessly integrates with your development environment to provide:

1. **Automated Security Analysis**: Scan your smart contracts to identify potential vulnerabilities
2. **Dynamic Penetration Test Generation**: Create targeted tests to verify exploitability
3. **Local Blockchain Testing**: Run tests against deployed contracts in a controlled environment
4. **Adaptive Testing Refinement**: Intelligently optimize tests based on execution results
5. **Comprehensive Security Reports**: Get detailed findings and recommendations

## 🚀 Features

### 🔍 Smart Contract Analysis
- Instantly scan Solidity and Rust contracts for security flaws
- Identify high-risk vulnerabilities including reentrancy, overflow/underflow, access control issues
- Receive detailed vulnerability explanations with severity classifications

### 🧪 Penetration Test Generation
- Generate specialized test scripts for detected vulnerabilities
- Test scripts use Hardhat and work out-of-the-box with your project
- No need to write complex test logic or understand exploit mechanics

### ⚙️ Local Testing Environment
- Launch a local Hardhat node with a single click
- Automatically deploy your contracts for testing
- Simulate real-world interactions in a controlled environment

### 🔄 Adaptive Test Refinement
- Tests automatically refine based on execution results
- Multiple testing strategies applied for thorough coverage
- Smart failure analysis to distinguish between secure contracts and test implementation issues

### 📊 Security Reporting
- Visual dashboard showing vulnerability status
- Test execution results with detailed output
- Exportable security reports for documentation and auditing

## 📖 Usage Guide

### Analyzing Contracts

1. Open any Solidity (.sol) or Rust (.rs) file
2. Right-click in the editor and select "CodeGene: Analyze Smart Contract"
3. View the analysis results in the CodeGene panel

### Creating Penetration Tests

1. After analysis, review the detected vulnerabilities
2. Click "Test Vulnerabilities" to generate tests for all findings
3. Alternatively, select specific vulnerabilities to test individually

### Running Tests

1. Use the "Start Hardhat Node" button to launch a local blockchain
2. Tests run automatically against your deployed contracts
3. Review results showing whether exploits succeeded or failed

### Reviewing Security Status

- Green indicators show secure contracts that resisted exploitation
- Red indicators show successfully exploited vulnerabilities
- Yellow indicators highlight potential issues needing further investigation

## 📷 Screenshots

![Contract Analysis](media/screenshot-analysis.png)
![Penetration Testing](media/screenshot-testing.png)
![Security Report](media/screenshot-report.png)

## 💡 Supported Vulnerability Types

- Reentrancy vulnerabilities
- Access control issues
- Integer overflow/underflow
- Front-running opportunities
- Logic errors and business logic flaws
- And many more...

---

Made with ❤️ for blockchain developers and security researchers