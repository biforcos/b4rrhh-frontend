import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '../..');
const inputSpec = path.resolve(workspaceRoot, 'openapi/personnel-administration-api.yaml');
const outputDirectory = path.resolve(workspaceRoot, 'src/app/core/api/generated');

if (!existsSync(inputSpec)) {
  console.error(`OpenAPI contract not found at ${inputSpec}.`);
  console.error('The contract is versioned in this repository, so a clean checkout always has it.');
  console.error('If it is missing, the checkout is incomplete or the file was deleted locally.');
  process.exit(1);
}

// Se borra antes de generar (`b4rrhh/workspace#14`). El generador escribe encima, no limpia:
// un endpoint o un modelo que desaparece del contrato deja aqui su fichero de ayer, y ese
// fichero compila e importa igual de bien que los buenos. Es la misma forma que el `.class`
// viejo que dio `test-compile` en verde sobre un fuente roto. Aqui no se nota en el pipeline
// -la carpeta esta en .gitignore y un checkout limpio la trae vacia-, se nota en el portatil,
// que es donde se mira el diff antes de commitear.
rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const generatorArgs = [
  '--no-install',
  'openapi-generator-cli',
  'generate',
  '-g',
  'typescript-angular',
  '-i',
  inputSpec,
  '-o',
  outputDirectory,
  '--global-property',
  'apis,models,supportingFiles',
  '--additional-properties',
  'providedIn=root,useSingleRequestParameter=true,withInterfaces=true,stringEnums=true,modelPropertyNaming=original,fileNaming=kebab-case',
  ...process.argv.slice(2),
];

const result = spawnSync('npx', generatorArgs, {
  cwd: workspaceRoot,
  stdio: 'inherit',
  shell: true,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const generatedReadmePath = path.resolve(outputDirectory, 'README.md');
const generatedReadme = `# Generated API client

This folder is generated from the OpenAPI contract.

- Do not edit files here manually.
- Regenerate with: npm run api:generate (runs automatically before build and start).
- Put custom API adapters and mappers outside generated in src/app/core/api/clients and src/app/core/api/mappers.
`;

writeFileSync(generatedReadmePath, generatedReadme, 'utf8');
