# 🧬 CodeGene — Smart Contract Insurance & Security Platform

![CodeGene Logo](https://github.com/Dawe000/codegene/blob/main/website/public/codegene_logo.png)

**CodeGene** is a **Portia AI-powered** platform that brings **advanced security analysis** and **subscription-based insurance** to the world of smart contracts. By combining deep code intelligence with NFT-backed insurance, CodeGene delivers a comprehensive safety net for blockchain developers and protocols.

---

## 🚀 Core Features

- 🔎 **Portia AI-Powered fine-tuned Smart Contract Analysis**  
  Deep scanning of contract code to uncover vulnerabilities, assess complexity, and evaluate security posture.

- 🛡️ **Risk-Based Insurance Coverage**  
  Dynamic premiums based on AI-generated risk profiles and audit results.

- 🧾 **NFT Insurance Certificates**  
  ERC-721 tokens act as verifiable on-chain proofs of insurance — owned and managed in your wallet.

- 🔄 **Cross-Chain Contract Translation**  
  Translate smart contracts between Solidity, Vyper, Rust, and more to improve accessibility and cross-chain development.

- 🔗 **On-Chain Claims Processing**  
  Fully decentralized and transparent filing and verification process for post-exploit compensation.

---

### 🧪 AI-Powered Auditing & Penetration Testing (VS Code Extension)

- 💻 **VS Code Integration**: Delivered as a user-friendly extension for Hardhat-based projects within Visual Studio Code.
- 🤖 **Automated Smart Contract Analysis**: Uses LLMs to scan and identify vulnerabilities directly from your IDE.
- 🎯 **Dynamic Penetration Test Generation**: Instantly generates tailored exploit test scripts based on detected risks.
- 🧱 **Seamless Local Node Setup**: Launches a local Hardhat environment for realistic attack simulations.
- 🔁 **Iterative Test Optimization**: Refines tests in real time, adapting to feedback from previous runs.
- 📊 **In-Editor Reporting**: Displays clear, actionable security insights and remediation steps inside the editor.

> This extension dramatically simplifies and accelerates the smart contract audit process — right from your development workspace.

## 🏆 Bounty Implementations

### 🔐 Nethermind Bounty

- ✅ **Solidity/Yul Bytecode Analysis**: Integrated Nethermind’s tooling to detect low-level vulnerabilities.
- 🌐 **Cross-Chain Compatibility**: Supports Ethereum-compatible networks via Nethermind infrastructure.
- ⚡ **Gas Optimization Tools**: AI generates gas usage reports and optimization recommendations.
- 🧮 **Formal Verification**: Compatible with Nethermind-backed formal methods for provable contract correctness.

---

### 🪙 Zora Bounty

- 🔄 **Smart Contract to Token Pipeline**: Integrated Zora Coins SDK to convert contract analysis into tradable tokens.
- 🔐 **Security-Based Tokenomics**: AI risk scores influence token distribution for balanced economics.
- ⚡ **One-Click Deployment**: Simple flow for generating and deploying Zora Coins on the Base chain.
- 📦 **Automated Metadata on IPFS**: Token metadata includes embedded security metrics for transparency.
- 📊 **Community Distribution Tools**: Visual interfaces for token allocation, guided by AI-backed strategies.

---

### 🧠 Portia Bounty

- 🧩 **Transparent AI Architecture**: Implemented Portia’s planning system to expose AI reasoning behind analysis decisions.
- 🛡️ **Enhanced Contract Analysis**: Fine-tuned for better detection of reentrancy, access control flaws, and gas inefficiencies.
- 🔀 **Multi-Model Integration**: Combined Portia’s planner with Venice’s models and built a failover system for uninterrupted AI service.
- 👁️ **Step-by-Step Assessment Visibility**: Shows full evaluation pipeline —  
  `Analysis → Scoring → Risk Evaluation → Tokenomics Suggestions → Deployment`
- ⚙️ **Technical Implementation**:
  - FastAPI backend with dynamic model routing
  - Structured API integration with React frontend
  - Backward-compatible with legacy services while enabling new AI features


---

## ⚙️ Technical Implementation

- **Smart Contract Analysis Service**  
  → AI risk engine with vulnerability mapping & recommendations

- **ERC-721 Insurance Contract**  
  → Deployed NFT-based certificate system

- **Web3 Frontend**  
  → Submit, analyze, insure, and manage contracts in a friendly UI

- **Claims Processing System**  
  → Evidence submission, on-chain verification, and payout logic

---

## 🔄 How It Works

1. **Submit Contract**  
   Upload your smart contract source or address for AI-based analysis.

2. **Receive Assessment**  
   AI evaluates the code and generates a security report with a risk score.

3. **Select Coverage**  
   Choose duration and coverage based on the contract’s risk rating.

4. **Mint Policy NFT**  
   Pay premium and receive a verifiable NFT certificate in your wallet.

5. **Manage Coverage**  
   Renew, cancel, or file exploit claims through the CodeGene dashboard.

---

## 📍 Future Roadmap

- 🌉 Multi-Chain Ecosystem Support
- 🛡 Protocol-Wide Umbrella Coverage
- 📚 Educational Knowledge Base for Vulnerability Prevention

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/dawe000/codegene.git

# Navigate to the project directory
cd codegene/website

# Install dependencies
npm install

# Clone the .env.example and use your own api keys as layed out in example

# Start the development server
npm start
