"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  ReactFlow,
  MarkerType,
  BackgroundVariant,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { useActiveSession } from "@/hooks/use-active-session";
import { useActiveDbContext } from "@/hooks/use-active-db-context";
import { toFlowGraph, type ErdFlowNode, type ErdTableNodeData } from "@/lib/erd/graph";
import type { ErdSchemaModel } from "@/lib/erd/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DiagramToolbar } from "@/components/db-manager/erd/diagram-toolbar";
import { ErdTableNode } from "@/components/db-manager/erd/table-node";
import { TableListPanel } from "@/components/db-manager/erd/table-list-panel";

type DiagramResponse = ErdSchemaModel & {
  availableDatabases: { name: string }[];
  availableSchemas: { name: string }[];
  selectedDatabase?: string;
  selectedSchema?: string;
};

const nodeTypes = {
  erdTable: ErdTableNode,
};

function RelationalDiagramCanvas() {
  const { sessionId } = useActiveSession();
  const { database: activeDatabase, schema: activeSchema, setContext, isReady } = useActiveDbContext();
  const [diagram, setDiagram] = useState<DiagramResponse | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>();
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<ErdFlowNode, Edge> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadToken, setLoadToken] = useState(0);

  const [nodes, setNodes, onNodesChange] = useNodesState<ErdFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const load = useCallback(
    async (db?: string, sch?: string) => {
      if (!sessionId) return;
      setIsLoading(true);
      try {
        const qs = new URLSearchParams({ sessionId });
        if (db) qs.set("database", db);
        if (sch) qs.set("schema", sch);
        const res = await fetch(`/api/relational-diagram?${qs.toString()}`);
        const payload = await res.json();
        if (!res.ok || !payload.ok) {
          throw new Error(payload.error ?? "Unable to load relational diagram");
        }
        setDiagram(payload.data as DiagramResponse);
        const nextDatabase = payload.data.selectedDatabase ?? "";
        const nextSchema = payload.data.selectedSchema ?? "";
        if (nextDatabase !== activeDatabase || nextSchema !== activeSchema) {
          setContext({ database: nextDatabase, schema: nextSchema });
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load relational diagram");
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, activeDatabase, activeSchema, setContext],
  );

  useEffect(() => {
    if (!sessionId || !isReady) return;
    load(activeDatabase || undefined, activeSchema || undefined);
  }, [load, loadToken, sessionId, activeDatabase, activeSchema, isReady]);

  const filteredTables = useMemo(() => {
    const tables = diagram?.tables ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((table) => table.name.toLowerCase().includes(q));
  }, [diagram?.tables, search]);

  useEffect(() => {
    if (!diagram) return;
    const graph = toFlowGraph(diagram);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setSelectedTableId(undefined);
  }, [diagram, setNodes, setEdges]);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        data: {
          ...node.data,
          highlighted: node.id === selectedTableId,
        },
      })),
    );
  }, [selectedTableId, setNodes]);

  const onSelectTable = useCallback(
    (tableId: string) => {
      setSelectedTableId(tableId);
      const selected = nodes.find((node) => node.id === tableId);
      if (selected && flowInstance) {
        flowInstance.setCenter(selected.position.x + 140, selected.position.y + 100, { zoom: 1.2, duration: 450 });
      }
    },
    [nodes, flowInstance],
  );

  const exportJson = useCallback(() => {
    if (!diagram) return;
    const blob = new Blob([JSON.stringify(diagram, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `db-zoo-erd-${diagram.database ?? "database"}-${diagram.schema ?? "schema"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [diagram]);

  const runAutoLayout = useCallback(() => {
    if (!diagram) return;
    const graph = toFlowGraph(diagram, selectedTableId);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setTimeout(() => flowInstance?.fitView({ duration: 450, padding: 0.18 }), 30);
  }, [diagram, selectedTableId, setNodes, setEdges, flowInstance]);

  if (!sessionId) {
    return <p className="text-sm text-muted-foreground">No active session. Connect from the login screen first.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Relational Diagram</h1>
        <p className="text-sm text-muted-foreground">Explore tables and foreign key relationships for the active schema.</p>
      </div>

      <p className="text-xs text-muted-foreground">
        Active context: {activeDatabase || diagram?.selectedDatabase || "default"}.
        {activeSchema || diagram?.selectedSchema || "public"}
      </p>

      <DiagramToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => setLoadToken((value) => value + 1)}
        onFitView={() => flowInstance?.fitView({ duration: 450, padding: 0.18 })}
        onAutoLayout={runAutoLayout}
        onExport={exportJson}
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <TableListPanel tables={filteredTables} selectedTableId={selectedTableId} onSelectTable={onSelectTable} />

        <Card className="overflow-hidden">
          <CardHeader className="py-2">
            <CardTitle className="text-sm font-medium">
              {isLoading
                ? "Loading diagram..."
                : `${diagram?.tables.length ?? 0} tables • ${diagram?.relationships.length ?? 0} relationships`}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[72vh] p-0">

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => onSelectTable(node.id)}
              onNodeMouseEnter={(_, node) => {
                setEdges((eds) => 
                  eds.map((e) => (e.source === node.id || e.target === node.id) 
                    ? { ...e, className: 'animated-edge' } 
                    : e
                  )
                );
              }}
              onNodeMouseLeave={() => {
                setEdges((eds) => eds.map((e) => ({ ...e, className: '' })));
              }}
              onInit={setFlowInstance}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              className="bg-background"
              minZoom={0.01}
            >
              <Background 
                color="hsl(var(--foreground))" 
                variant={BackgroundVariant.Dots} 
                gap={24} 
                size={1}
              />
              {/* <Controls /> */}
              <MiniMap 
                nodeColor="#10b981" 
                maskColor="rgba(0, 0, 0, 0.7)" 
                style={{ backgroundColor: '#020617' }} 
              />

            </ReactFlow>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function RelationalDiagramView() {
  return (
    <ReactFlowProvider>
      <RelationalDiagramCanvas />
    </ReactFlowProvider>
  );
}
