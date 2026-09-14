/**
 * Resources - Exposição dos Documentos via URI
 *
 * Expõe os arquivos de documentação como recursos acessíveis via URI scheme:
 * fb-marketing-docs://docs/{path}
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadAllDocuments, loadMarkdownFile, resolveDocumentPath, DocumentInfo } from './utils/fileLoader.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const URI_SCHEME = 'fb-marketing-docs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Guias curados (não scrapados) que ficam no root do pacote
type GuideResource = {
  slug: string;
  filename: string;
  name: string;
  description: string;
};

const GUIDES: GuideResource[] = [
  {
    slug: 'skill',
    filename: 'SKILL.md',
    name: 'SKILL — Guia do gestor de tráfego',
    description: 'Instruções de skill para agentes IA usarem o MCP como gestor de tráfego.',
  },
  {
    slug: 'playbook',
    filename: 'PLAYBOOK.md',
    name: 'PLAYBOOK — Regras de otimização',
    description: 'Regras de negócio, thresholds e fluxos de diagnóstico/otimização.',
  },
  {
    slug: 'andromeda',
    filename: 'ANDROMEDA.md',
    name: 'ANDROMEDA - Guia do projeto',
    description: 'Guia estratégico do projeto com referências técnicas. Não é documentação oficial da Meta.',
  },
];

function getProjectRoot(): string {
  // Quando rodando do build local (dist/) ou instalado via npm (node_modules/fb-marketing-mcp/dist/),
  // os .md de guias ficam um nível acima de dist/.
  return path.resolve(__dirname, '..');
}

function readGuide(slug: string): string | null {
  const guide = GUIDES.find((g) => g.slug === slug);
  if (!guide) return null;

  const filePath = path.join(getProjectRoot(), guide.filename);
  if (!fs.existsSync(filePath)) return null;

  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Converte um documento para formato de resource
 */
function documentToResource(doc: DocumentInfo): {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
} {
  return {
    uri: `${URI_SCHEME}://docs/${doc.relativePath}`,
    name: doc.title,
    description: `${doc.stale ? 'Atualização pendente. ' : ''}${doc.description || `Documentação: ${doc.relativePath}`}`,
    mimeType: 'text/markdown',
  };
}

type UriResolution =
  | { kind: 'doc'; relativePath: string }
  | { kind: 'guide'; slug: string }
  | { kind: 'unknown' };

function resolveUri(uri: string): UriResolution {
  const docPrefix = `${URI_SCHEME}://docs/`;
  if (uri.startsWith(docPrefix)) {
    return { kind: 'doc', relativePath: uri.substring(docPrefix.length) };
  }

  const guidePrefix = `${URI_SCHEME}://guides/`;
  if (uri.startsWith(guidePrefix)) {
    return { kind: 'guide', slug: uri.substring(guidePrefix.length) };
  }

  return { kind: 'unknown' };
}

/**
 * Registra handlers de resources no servidor
 */
export function registerResourceHandlers(server: Server): void {
  // Handler para listar recursos disponíveis (docs scrapados + guias curados)
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    const documents = loadAllDocuments();
    const docResources = documents.map(documentToResource);

    const guideResources = GUIDES.filter((guide) => readGuide(guide.slug) !== null).map((g) => ({
      uri: `${URI_SCHEME}://guides/${g.slug}`,
      name: g.name,
      description: g.description,
      mimeType: 'text/markdown',
    }));

    const resources = [...guideResources, ...docResources];
    const cursor = request.params?.cursor;
    const offset = cursor === undefined ? 0 : Number(cursor);
    if (cursor !== undefined && (!/^\d+$/.test(cursor) || !Number.isSafeInteger(offset) || offset > resources.length)) {
      throw new Error('Cursor de resources inválido');
    }
    const pageSize = 100;
    const end = Math.min(offset + pageSize, resources.length);
    return { resources: resources.slice(offset, end), ...(end < resources.length ? { nextCursor: String(end) } : {}) };
  });

  // Handler para ler um recurso específico
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const resolved = resolveUri(uri);

    if (resolved.kind === 'doc') {
      const fullPath = resolveDocumentPath(resolved.relativePath);
      const doc = fullPath ? loadMarkdownFile(fullPath) : null;
      if (!doc) {
        throw new Error(`Documento não encontrado: ${resolved.relativePath}`);
      }
      return {
        contents: [{ uri, mimeType: 'text/markdown', text: doc.content }],
      };
    }

    if (resolved.kind === 'guide') {
      const content = readGuide(resolved.slug);
      if (content === null) {
        throw new Error(`Guia não encontrado: ${resolved.slug}`);
      }
      return {
        contents: [{ uri, mimeType: 'text/markdown', text: content }],
      };
    }

    throw new Error(
      `URI inválida: ${uri}. Use ${URI_SCHEME}://docs/{caminho} ou ${URI_SCHEME}://guides/{skill|playbook|andromeda}`
    );
  });

  // Handler para templates de recursos
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
      resourceTemplates: [
        {
          uriTemplate: `${URI_SCHEME}://docs/{path}`,
          name: 'Documento da Marketing API',
          description: 'Acessa um documento específico da documentação scrapada de developers.facebook.com',
          mimeType: 'text/markdown',
        },
        {
          uriTemplate: `${URI_SCHEME}://guides/{slug}`,
          name: 'Guia curado do projeto',
          description: 'Acessa um guia curado do projeto (skill, playbook, andromeda)',
          mimeType: 'text/markdown',
        },
      ],
    };
  });
}
