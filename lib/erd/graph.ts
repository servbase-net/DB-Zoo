import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { ErdSchemaModel, ErdTable } from "@/lib/erd/types";

export type ErdTableNodeData = {
  table: ErdTable;
  highlighted: boolean;
};

export type ErdFlowNode = Node<ErdTableNodeData, "erdTable">;

export function buildInitialTableLayout(tables: ErdTable[]) {
  const sortedTables = [...tables].sort((a, b) => b.columns.length - a.columns.length || a.name.localeCompare(b.name));
  const columns = Math.max(1, Math.ceil(Math.sqrt(sortedTables.length)));
  const xGap = 520;
  const yGap = 100;
  const positions = new Map<string, { x: number; y: number }>();
  const columnHeights = new Array(columns).fill(0);

  sortedTables.forEach((table) => {
    const estimatedHeight = 68 + table.columns.length * 34;
    const col = columnHeights.indexOf(Math.min(...columnHeights));
    const y = columnHeights[col];
    positions.set(table.id, { x: col * xGap, y });
    columnHeights[col] = y + estimatedHeight + yGap;
  });

  return positions;
}

export function toFlowGraph(
  model: ErdSchemaModel,
  highlightedTableId?: string,
): { nodes: ErdFlowNode[]; edges: Edge[] } {
  const layout = buildInitialTableLayout(model.tables);

  const nodes: ErdFlowNode[] = model.tables.map((table) => ({
    id: table.id,
    type: "erdTable",
    position: layout.get(table.id) ?? { x: 0, y: 0 },
    data: {
      table,
      highlighted: highlightedTableId === table.id,
    },
    draggable: true,
  }));

  const edges: Edge[] = model.relationships.map((relationship, index) => {
    const sourceNode = nodes.find((node) => node.id === relationship.sourceTableId);
    const targetNode = nodes.find((node) => node.id === relationship.targetTableId);
    const horizontalDistance = Math.abs((sourceNode?.position.x ?? 0) - (targetNode?.position.x ?? 0));
    return {
      id: relationship.id,
      source: relationship.sourceTableId,
      target: relationship.targetTableId,
      sourceHandle: relationship.sourceColumnId,
      targetHandle: relationship.targetColumnId,
      type: "step",
      pathOptions: {
        offset: Math.min(120, Math.max(36, Math.floor(horizontalDistance / 6))),
        borderRadius: 10,
      },
      animated: false,
      label: relationship.name,
      style: {
        strokeWidth: 1.8,
      },
      zIndex: 6 + (index % 2),
      data: {
        onDelete: relationship.onDelete,
        onUpdate: relationship.onUpdate,
      },
      markerEnd: { type: MarkerType.ArrowClosed },
    };
  });

  return { nodes, edges };
}
