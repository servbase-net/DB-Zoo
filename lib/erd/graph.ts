import { MarkerType, type Edge, type Node, Position } from "@xyflow/react";
import type { ErdSchemaModel, ErdTable, ErdRelationship } from "@/lib/erd/types";
import dagre from "dagre";

export type ErdTableNodeData = {
  table: ErdTable;
  isHighlighted: boolean;
  isConnected?: boolean;
};

export type ErdFlowNode = Node<ErdTableNodeData, "erdTable">;

const TABLE_WIDTH = 280;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;

function getLayoutedElements(nodes: ErdFlowNode[], edges: Edge[]) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  dagreGraph.setGraph({ 
    rankdir: "LR", 
    nodesep: 100, 
    ranksep: 180,
    marginx: 50,
    marginy: 50 
  });

  nodes.forEach((node) => {
    const tableHeight = HEADER_HEIGHT + (node.data.table.columns.length * ROW_HEIGHT);
    dagreGraph.setNode(node.id, { width: TABLE_WIDTH, height: tableHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const tableHeight = HEADER_HEIGHT + (node.data.table.columns.length * ROW_HEIGHT);
    
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - TABLE_WIDTH / 2,
        y: nodeWithPosition.y - tableHeight / 2,
      },
    };
  });
}

export function toFlowGraph(
  model: ErdSchemaModel,
  selectedTableId?: string,
): { nodes: ErdFlowNode[]; edges: Edge[] } {
  
  const connectedTableIds = new Set<string>();
  if (selectedTableId) {
    connectedTableIds.add(selectedTableId);
    model.relationships.forEach(rel => {
      if (rel.sourceTableId === selectedTableId) connectedTableIds.add(rel.targetTableId);
      if (rel.targetTableId === selectedTableId) connectedTableIds.add(rel.sourceTableId);
    });
  }

  const rawNodes: ErdFlowNode[] = model.tables.map((table) => ({
    id: table.id,
    type: "erdTable",
    data: {
      table,
      isHighlighted: selectedTableId === table.id,
      isConnected: connectedTableIds.has(table.id),
    },
    position: { x: 0, y: 0 },
    draggable: true,
  }));

  const edges: Edge[] = model.relationships.map((rel) => {
    const isRelevant = selectedTableId && 
      (rel.sourceTableId === selectedTableId || rel.targetTableId === selectedTableId);

    const isDirectlySelected = selectedTableId === rel.sourceTableId || selectedTableId === rel.targetTableId;

    return {
      id: rel.id,
      source: rel.sourceTableId,
      target: rel.targetTableId,
      sourceHandle: rel.sourceColumnId,
      targetHandle: rel.targetColumnId,
      type: "smoothstep",
      animated: !!isDirectlySelected,
      interactionWidth: 25,
      pathOptions: { borderRadius: 24, offset: 40 },
      style: { 
        strokeWidth: isDirectlySelected ? 3 : 2,
        stroke: isDirectlySelected ? "#3b82f6" : "#94a3b8",
        opacity: selectedTableId && !isRelevant ? 0.2 : 1,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: isDirectlySelected ? "#3b82f6" : "#94a3b8",
      },
    };
  });

  const nodes = getLayoutedElements(rawNodes, edges);

  return { nodes, edges };
}