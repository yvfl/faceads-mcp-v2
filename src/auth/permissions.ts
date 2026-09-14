/** Permissions are derived from the executable registry; unknown tools fail closed. */
import { toolRegistry } from '../tools/registry.js';
export type PermissionLevel = 'read' | 'write' | 'method';
export const TOOL_PERMISSIONS: Record<string, PermissionLevel> = Object.fromEntries(
  Object.entries(toolRegistry).map(([name, entry]) => [name, entry.permission])
);

export function checkPermission(toolName: string, userPermissions: string, method?: string): boolean {
  if (!Object.hasOwn(toolRegistry, toolName)) return false;
  if (userPermissions !== 'read' && userPermissions !== 'readwrite') return false;
  const required = toolRegistry[toolName].permission;
  if (required === 'method') {
    if (!method || !['GET', 'POST', 'DELETE'].includes(method)) return false;
    return method === 'GET' || userPermissions === 'readwrite';
  }
  return required === 'read' || userPermissions === 'readwrite';
}
