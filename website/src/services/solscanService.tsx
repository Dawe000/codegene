import axios from 'axios';

export const getSolanaProgram = async (programId: string): Promise<string> => {
  const baseUrl = 'https://public-api.solscan.io';

  try {
    const metadataRes = await axios.get(`${baseUrl}/account/metadata?address=${programId}`, {
      headers: {
        Accept: 'application/json',
        Token: process.env.REACT_APP_SOLSCAN_API_KEY || '',
      },
    });

    if (metadataRes.data?.type === 'program') {
      return `// Solana Program ID: ${programId}\n// Program type confirmed via metadata\n// Source code is not provided directly by Solscan.\n// Try checking the GitHub repo or Explorer links.`;
    }

    return `// ${programId} is not recognized as a Solana program ID.`;
  } catch (error: any) {
    console.error('Solscan metadata error:', error.message);
    throw new Error('Failed to fetch program metadata from Solscan');
  }
};
