// src/types/global.d.ts
interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request?: (params: { method: string; params?: any }) => Promise<any>;
      on?: (event: string, callback: (...args: any[]) => void) => void;
      removeListener?: (event: string, callback: (...args: any[]) => void) => void;
      selectedAddress?: string;
      chainId?: string;
      networkVersion?: string;
      enable?: () => Promise<string[]>;
    };
  }