const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(__dirname, 'prisma/schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

const datasourceMatch = schemaContent.match(/datasource\s+db\s*\{([^}]+)\}/);
console.log('datasourceMatch:', datasourceMatch);
let provider = 'sqlite';
if (datasourceMatch) {
  const providerMatch = datasourceMatch[1].match(/provider\s*=\s*"([^"]+)"/);
  console.log('providerMatch:', providerMatch);
  if (providerMatch) {
    provider = providerMatch[1].trim().toLowerCase();
  }
}
console.log('provider resolved:', provider);
