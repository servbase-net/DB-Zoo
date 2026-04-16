import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { ErdSchemaModel, ErdTable } from "@/lib/erd/types";

export type ErdTableNodeData = {
  table: ErdTable;
  highlighted: boolean;
};

export type ErdFlowNode = Node<ErdTableNodeData, "erdTable">;

export function buildInitialTableLayout(tables: ErdTable[]) {
  const positions = new Map<string, { x: number; y: number }>();
  
  const xGap = 420;      
  const verticalPadding = 60; 
  const cols = 3;
  
  const columnHeights = new Array(cols).fill(0);

  tables.forEach((table, i) => {
    const colIndex = i % cols;
    const tableHeight = 60 + (table.columns.length * 32);

    const x = colIndex * xGap;
    const y = columnHeights[colIndex];

    positions.set(table.id, { x, y });

    columnHeights[colIndex] += tableHeight + verticalPadding;
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

  const edges: Edge[] = model.relationships.map((rel) => ({
    id: rel.id,
    source: rel.sourceTableId,
    target: rel.targetTableId,
    sourceHandle: rel.sourceColumnId,
    targetHandle: rel.targetColumnId,
    type: "smoothstep",
    interactionWidth: 20,
    style: {
      strokeWidth: 2,
    },
    markerEnd: {
      type: MarkerType ? MarkerType.ArrowClosed : ("arrowclosed" as any),
      width: 20,
      height: 20,
    },
  }));

  return { nodes, edges };
}