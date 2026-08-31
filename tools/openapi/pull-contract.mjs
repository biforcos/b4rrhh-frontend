import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '../..');
const backendContractPath = path.resolve(
  workspaceRoot,
  '../b4rrhh_backend/openapi/personnel-administration-api.yaml',
);
const localContractDirectory = path.resolve(workspaceRoot, 'openapi');
const localContractPath = path.resolve(localContractDirectory, 'personnel-administration-api.yaml');
const generatedDirectory = path.resolve(workspaceRoot, 'src/app/core/api/generated');
const generatedContractPath = path.resolve(generatedDirectory, 'personnel-administration-api.yaml');

if (!existsSync(backendContractPath)) {
  console.error(`Backend contract not found at ${backendContractPath}.`);
  console.error('');
  console.error('api:pull is only needed to UPDATE the versioned contract from a sibling');
  console.error('backend checkout. It is NOT needed to build: "npm run api:generate" (run');
  console.error('automatically by "npm run build" and "npm start") works from the contract');
  console.error('already versioned in openapi/.');
  process.exit(1);
}

mkdirSync(localContractDirectory, { recursive: true });
mkdirSync(generatedDirectory, { recursive: true });
copyFileSync(backendContractPath, localContractPath);
copyFileSync(backendContractPath, generatedContractPath);

const versionMatch = readFileSync(localContractPath, 'utf8').match(/^\s*version:\s*(.+)$/m);
const contractVersion = versionMatch ? versionMatch[1].trim() : 'unknown';

console.log(`OpenAPI contract synced to ${localContractPath}`);
console.log(`OpenAPI contract copied to ${generatedContractPath}`);
console.log(`Contract version pulled: ${contractVersion}`);
console.log('This overwrites the versioned contract: review the diff of openapi/*.yaml and commit it deliberately.');
