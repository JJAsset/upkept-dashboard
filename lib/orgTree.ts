import { UpkeptClient, asArray } from "./upkeptClient";

export const stripHyphens = (s: unknown): string => String(s ?? "").replace(/-/g, "");
export const norm = (s: unknown): string => stripHyphens(s).toLowerCase();

export interface Association {
  id: string; // hyphenated entityId
  name: string;
  hierarchy: string;
}

interface TreeNode {
  entityId?: string;
  name?: string;
  hierarchy?: string;
  type?: string;
  subNodeLinks?: TreeNode[];
}

export interface OrgTree {
  associations: Association[];
  /** normalized propertyId -> association */
  propertyToAssociation: Map<string, Association>;
}

export async function loadOrgTree(client: UpkeptClient): Promise<OrgTree> {
  const assocNodes = asArray<TreeNode>((await client.callTool("getTreeNodes", { isA: "ASSOCIATION" })).data);
  const propNodes = asArray<TreeNode>((await client.callTool("getTreeNodes", { isA: "PROPERTY" })).data);

  const associations: Association[] = assocNodes
    .filter((a) => a.entityId)
    .map((a) => ({ id: a.entityId as string, name: a.name ?? "(unnamed)", hierarchy: a.hierarchy ?? "" }));

  const propertyToAssociation = new Map<string, Association>();

  const assignProperty = (propEntityId: string | undefined, propHierarchy: string | undefined) => {
    if (!propEntityId) return;
    let best: Association | undefined;
    for (const a of associations) {
      if (!a.hierarchy) continue;
      const matches = propHierarchy === a.hierarchy || (propHierarchy?.startsWith(a.hierarchy + ".") ?? false);
      if (matches && (!best || a.hierarchy.length > best.hierarchy.length)) best = a;
    }
    if (best) propertyToAssociation.set(norm(propEntityId), best);
  };

  // Primary: all PROPERTY nodes matched by hierarchy prefix
  for (const p of propNodes) assignProperty(p.entityId, p.hierarchy);

  // Fallback: properties listed directly under each association's subNodeLinks
  for (const a of assocNodes) {
    for (const sub of a.subNodeLinks ?? []) {
      if (sub.type === "PROPERTY" && sub.entityId && !propertyToAssociation.has(norm(sub.entityId))) {
        propertyToAssociation.set(norm(sub.entityId), {
          id: a.entityId as string,
          name: a.name ?? "(unnamed)",
          hierarchy: a.hierarchy ?? "",
        });
      }
    }
  }

  return { associations, propertyToAssociation };
}
