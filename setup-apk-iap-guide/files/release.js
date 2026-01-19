const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const TAURI_CONFIG = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');

function exec(command, options = {}) {
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
    return result ? result.trim() : '';
  } catch (error) {
    if (options.ignoreError) {
      return '';
    }
    throw error;
  }
}

function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function main() {
  if (!fs.existsSync(TAURI_CONFIG)) {
    console.error(`❌ Erro: ${TAURI_CONFIG} não encontrado`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(TAURI_CONFIG, 'utf8'));
  const currentVersion = config.version;

  if (!currentVersion) {
    console.error(`❌ Erro: Não foi possível ler a versão do ${TAURI_CONFIG}`);
    process.exit(1);
  }

  const versionParts = currentVersion.split('.');
  const newPatch = parseInt(versionParts[2] || 0) + 1;
  const newVersion = `${versionParts[0]}.${versionParts[1]}.${newPatch}`;

  console.log(`📦 Versão atual: v${currentVersion}`);
  console.log(`🆙 Nova versão: v${newVersion}`);
  console.log('');
  console.log('A versão patch será incrementada automaticamente.');
  console.log('');

  const answer = await question('Deseja continuar? (s/N): ');
  
  if (!answer.toLowerCase().startsWith('s')) {
    console.log('❌ Cancelado pelo usuário');
    process.exit(0);
  }

  console.log(`📝 Atualizando versão em ${TAURI_CONFIG}...`);
  config.version = newVersion;
  fs.writeFileSync(TAURI_CONFIG, JSON.stringify(config, null, 2) + '\n');
  
  console.log(`✅ Versão atualizada para v${newVersion}`);
  console.log('');

  const remoteName = exec('git remote', { silent: true, ignoreError: true }).split('\n')[0] || 'origin';

  const commitAnswer = await question('Deseja commitar a mudança de versão? (s/N): ');
  
  if (commitAnswer.toLowerCase().startsWith('s')) {
    console.log('💾 Commitando mudança de versão...');
    exec(`git add ${TAURI_CONFIG}`);
    exec(`git commit -m "chore: bump version to v${newVersion}"`);
    console.log('✅ Commit realizado!');
    console.log('');
    
    const pushCommitAnswer = await question('Deseja fazer push do commit? (s/N): ');
    if (pushCommitAnswer.toLowerCase().startsWith('s')) {
      console.log('🚀 Enviando commit...');
      exec(`git push ${remoteName} HEAD`);
      console.log('✅ Commit enviado!');
      console.log('');
    }
  }

  const tag = `v${newVersion}`;

  const tagExists = exec(`git tag -l ${tag}`, { silent: true, ignoreError: true });
  
  if (tagExists) {
    console.log(`⚠️  A tag ${tag} já existe!`);
    const overwrite = await question('Deseja sobrescrever? (s/N): ');
    
    if (overwrite.toLowerCase().startsWith('s')) {
      console.log('🗑️  Removendo tag local e remota...');
      exec(`git tag -d ${tag}`, { ignoreError: true });
      exec(`git push ${remoteName} :refs/tags/${tag}`, { ignoreError: true });
    } else {
      console.log('❌ Cancelado');
      process.exit(0);
    }
  }

  console.log(`🏷️  Criando tag ${tag}...`);
  exec(`git tag ${tag}`);
  
  console.log(`🚀 Enviando tag para o GitHub (remote: ${remoteName})...`);
  exec(`git push ${remoteName} ${tag}`);

  const repoUrl = exec(`git config --get remote.${remoteName}.url`, { silent: true, ignoreError: true });
  const repoPath = repoUrl ? repoUrl.replace(/.*github\.com[:/](.*)\.git/, '$1') : '';

  console.log('');
  console.log(`✅ Tag ${tag} criada e enviada com sucesso!`);
  console.log('🤖 GitHub Actions iniciará o deploy automaticamente.');
  console.log(`📱 Acompanhe em: https://github.com/${repoPath}/actions`);
}

main().catch(error => {
  console.error('❌ Erro:', error.message);
  process.exit(1);
});
