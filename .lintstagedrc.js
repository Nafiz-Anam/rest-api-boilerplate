module.exports = {
  '*.{js,ts,jsx,tsx}': ['eslint --fix', 'prettier --write', 'git add'],
  '*.{json,md,yml,yaml}': ['prettier --write', 'git add'],
  '*.{css,scss,less}': ['prettier --write', 'git add'],
  '*.{prisma}': ['prettier --write', 'git add'],
};
