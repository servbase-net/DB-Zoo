import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { ErdSchemaModel, ErdTable, ErdRelationship } from "@/lib/erd/types";

export type ErdTableNodeData = {
  table: ErdTable;
  highlighted: boolean;
};

export type ErdFlowNode = Node<ErdTableNodeData, "erdTable">;

function calculateLayout(tables: ErdTable[], relationships: ErdRelationship[]) {
  const positions = new Map<string, { x: number; y: number }>();
  const tableMap = new Map(tables.map((t) => [t.id, t]));
  
  const influence = new Map<string, number>();
  tables.forEach(t => influence.set(t.id, 0));

  relationships.forEach(rel => {
    influence.set(rel.targetTableId, (influence.get(rel.targetTableId) || 0) + 2);
    influence.set(rel.sourceTableId, (influence.get(rel.sourceTableId) || 0) - 1);
  });

  const sortedByInfluence = [...tables].sort((a, b) => 
    (influence.get(b.id) || 0) - (influence.get(a.id) || 0)
  );

  const columns: string[][] = [[], [], [], []];
  sortedByInfluence.forEach((t) => {
    const score = influence.get(t.id) || 0;
    if (score >= 2) columns[0].push(t.id);
    else if (score >= 0.5) columns[1].push(t.id);
    else if (score >= -0.5) columns[2].push(t.id);
    else columns[3].push(t.id);
  });

  const X_GAP = 580;
  const Y_PADDING = 80;

  columns.forEach((colIds, colIdx) => {
    let currentY = 0;
    colIds.sort((a, b) => (tableMap.get(a)?.name || "").localeCompare(tableMap.get(b)?.name || ""));

    colIds.forEach((id) => {
      const table = tableMap.get(id);
      if (!table) return;

      positions.set(id, {
        x: colIdx * X_GAP,
        y: currentY
      });

      const tableHeight = 80 + (table.columns.length * 32);
      currentY += tableHeight + Y_PADDING;
    });
  });

  return positions;
}

export function toFlowGraph(
  model: ErdSchemaModel,
  highlightedTableId?: string,
): { nodes: ErdFlowNode[]; edges: Edge[] } {
  const layout = calculateLayout(model.tables, model.relationships);

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

  const edges: Edge[] = model.relationships.map((rel) => ({
    id: rel.id,
    source: rel.targetTableId,
    target: rel.sourceTableId,
    sourceHandle: rel.targetColumnId,
    targetHandle: rel.sourceColumnId,
    type: "smoothstep",
    pathOptions: { borderRadius: 32, offset: 50 },
    style: { strokeWidth: 2.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
    },
  }));

  return { nodes, edges };
}