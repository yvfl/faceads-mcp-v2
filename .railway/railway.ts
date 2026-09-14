import { defineRailway, github, postgres, preserve, project, service } from 'railway/iac';

// This file describes the entire dedicated v2 environment.
// Apply with `railway config apply`; importing GitHub alone does not apply IaC.
export default defineRailway(() => {
  const db = postgres('Postgres');
  const app = service('faceads-mcp-v2', {
    source: github('yvfl/faceads-mcp-v2', { branch: 'main' }),
    build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' },
    healthcheck: '/health',
    healthcheckTimeout: 120,
    replicas: 1,
    deploy: {
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 5,
    },
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      // Configure these once in the service; never rotate the encryption key on apply.
      MCP_ENCRYPTION_KEY: preserve(),
      MCP_BASE_URL: preserve(),
      META_API_VERSION: 'v26.0',
    },
  });

  // postgres() provisions its own persistent storage through Railway.
  return project('faceads-mcp-v2', { resources: [db, app] });
});
