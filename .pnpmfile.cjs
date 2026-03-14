// pnpm configuration file
// This ensures pnpm is always used as the package manager

module.exports = {
  // Force pnpm to be used even if npm is detected
  packageManager: 'pnpm',
  
  // Prefer pnpm over other package managers
  shamefullyHoist: true,
  
  // Strict peer dependencies
  strictPeerDependencies: false,
  
  // Node modules configuration
  nodeLinker: 'isolated',
  
  // Store configuration
  store: '~/.pnpm-store',
  
  // Patch configuration
  patches: {
    // Add any patches if needed
  },
  
  // Override configurations
  overrides: {
    // Override npm if needed
    npm: '^8.0.0'
  },
  
  // Peer dependency rules
  peerDependencyRules: {
    ignoreMissing: ['@prisma/client']
  }
};
