import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // Subir um nível de dist/ para a raiz do projeto
  return path.resolve(__dirname, '../..');
}

/**
 * Handler para get_skill - retorna conteúdo do SKILL.md
 */
export async function handleGetSkill(): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  try {
    const skillPath = path.join(getProjectRoot(), 'SKILL.md');
    
    if (!fs.existsSync(skillPath)) {
      return {
        content: [{ type: 'text', text: '# Erro\n\nArquivo SKILL.md não encontrado.' }],
        isError: true,
      };
    }
    
    const content = fs.readFileSync(skillPath, 'utf-8');
    
    return {
      content: [{ type: 'text', text: content }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `# Erro\n\nFalha ao ler SKILL.md: ${error}` }],
      isError: true,
    };
  }
}

/**
 * Handler para get_playbook - retorna conteúdo do PLAYBOOK.md
 */
export async function handleGetPlaybook(): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  try {
    const playbookPath = path.join(getProjectRoot(), 'PLAYBOOK.md');
    
    if (!fs.existsSync(playbookPath)) {
      return {
        content: [{ type: 'text', text: '# Erro\n\nArquivo PLAYBOOK.md não encontrado.' }],
        isError: true,
      };
    }
    
    const content = fs.readFileSync(playbookPath, 'utf-8');
    
    return {
      content: [{ type: 'text', text: content }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `# Erro\n\nFalha ao ler PLAYBOOK.md: ${error}` }],
      isError: true,
    };
  }
}

/**
 * Handler para get_andromeda - retorna conteúdo do ANDROMEDA.md
 */
export async function handleGetAndromeda(): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  try {
    const andromedaPath = path.join(getProjectRoot(), 'ANDROMEDA.md');
    
    if (!fs.existsSync(andromedaPath)) {
      return {
        content: [{ type: 'text', text: '# Erro\n\nArquivo ANDROMEDA.md não encontrado.' }],
        isError: true,
      };
    }
    
    const content = fs.readFileSync(andromedaPath, 'utf-8');
    
    return {
      content: [{ type: 'text', text: content }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `# Erro\n\nFalha ao ler ANDROMEDA.md: ${error}` }],
      isError: true,
    };
  }
}

