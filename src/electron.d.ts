export interface ElectronAPI {
  // Define your exposed APIs here
  // Example:
  // getVersion: () => string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
