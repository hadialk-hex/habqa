"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Bot, Plus, Trash2, Save, RefreshCw, Zap, Sparkles, X, 
  ArrowLeft, ZoomIn, ZoomOut, Maximize2, Move, Clock, Tag, 
  Smartphone, HelpCircle, AlertCircle, Edit, CheckCircle2,
  ChevronRight, Laptop, Settings
} from "lucide-react"
import api from "@/lib/api"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { useLanguage } from "@/lib/i18n/language-context"

// --- TYPES & DEFINITIONS ---

interface VisualNode {
  id: string;
  type: string;
  category: 'trigger' | 'action' | 'condition';
  name: string;
  x: number;
  y: number;
  configuration: Record<string, any>;
}

interface VisualConnection {
  id: string;
  fromNodeId: string;
  fromBranchLabel: string; // "next", "yes", "no"
  toNodeId: string;
}

interface Flow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  triggers?: any[];
  steps?: any[];
}

// Simple random UUID helper
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function FlowsPage() {
  const { t, locale, dir } = useLanguage();
  const localeCode = locale === "ar" ? "ar-EG" : "en-US";

  const NODE_TYPES = {
    // Triggers
    TRIGGER_KEYWORD: { type: 'TRIGGER_KEYWORD', category: 'trigger', name: t("flowsPage.nodeTriggerKeyword"), color: 'border-emerald-500 bg-emerald-950/40 text-emerald-200' },
    TRIGGER_NEW_SUBSCRIBER: { type: 'TRIGGER_NEW_SUBSCRIBER', category: 'trigger', name: t("flowsPage.nodeTriggerNewSubscriber"), color: 'border-emerald-500 bg-emerald-950/40 text-emerald-200' },
    TRIGGER_COMMENT: { type: 'TRIGGER_COMMENT', category: 'trigger', name: t("flowsPage.nodeTriggerComment"), color: 'border-emerald-500 bg-emerald-950/40 text-emerald-200' },
    TRIGGER_ANY_MESSAGE: { type: 'TRIGGER_ANY_MESSAGE', category: 'trigger', name: t("flowsPage.nodeTriggerAnyMessage"), color: 'border-emerald-500 bg-emerald-950/40 text-emerald-200' },

    // Actions
    ACTION_SEND_MESSAGE: { type: 'ACTION_SEND_MESSAGE', category: 'action', name: t("flowsPage.nodeActionSendMessage"), color: 'border-cyan-500 bg-cyan-950/40 text-cyan-200' },
    ACTION_TAG_ADD: { type: 'ACTION_TAG_ADD', category: 'action', name: t("flowsPage.nodeActionTagAdd"), color: 'border-cyan-500 bg-cyan-950/40 text-cyan-200' },
    ACTION_TAG_REMOVE: { type: 'ACTION_TAG_REMOVE', category: 'action', name: t("flowsPage.nodeActionTagRemove"), color: 'border-cyan-500 bg-cyan-950/40 text-cyan-200' },
    ACTION_NOTIFY_TEAM: { type: 'ACTION_NOTIFY_TEAM', category: 'action', name: t("flowsPage.nodeActionNotifyTeam"), color: 'border-cyan-500 bg-cyan-950/40 text-cyan-200' },
    ACTION_WAIT_DELAY: { type: 'ACTION_WAIT_DELAY', category: 'action', name: t("flowsPage.nodeActionWaitDelay"), color: 'border-cyan-500 bg-cyan-950/40 text-cyan-200' },

    // Conditions
    CONDITION_TAG_CHECK: { type: 'CONDITION_TAG_CHECK', category: 'condition', name: t("flowsPage.nodeConditionTagCheck"), color: 'border-amber-500 bg-amber-950/40 text-amber-200' },
    CONDITION_PLATFORM_CHECK: { type: 'CONDITION_PLATFORM_CHECK', category: 'condition', name: t("flowsPage.nodeConditionPlatformCheck"), color: 'border-amber-500 bg-amber-950/40 text-amber-200' },
    CONDITION_TIME_CHECK: { type: 'CONDITION_TIME_CHECK', category: 'condition', name: t("flowsPage.nodeConditionTimeCheck"), color: 'border-amber-500 bg-amber-950/40 text-amber-200' },
    CONDITION_KEYWORD_CHECK: { type: 'CONDITION_KEYWORD_CHECK', category: 'condition', name: t("flowsPage.nodeConditionKeywordCheck"), color: 'border-amber-500 bg-amber-950/40 text-amber-200' },
  };

  const getInitialConfig = (type: string) => {
    switch (type) {
      case 'TRIGGER_KEYWORD': return { keywords: '' };
      case 'TRIGGER_COMMENT': return { postId: '' };
      case 'ACTION_SEND_MESSAGE': return { text: t("flowsPage.defaultSendMessageText"), mediaUrl: '' };
      case 'ACTION_TAG_ADD':
      case 'ACTION_TAG_REMOVE': return { tag: '' };
      case 'ACTION_NOTIFY_TEAM': return { message: t("flowsPage.defaultNotifyTeamMessage") };
      case 'ACTION_WAIT_DELAY': return { delayAmount: 5, delayUnit: 'minutes' };
      case 'CONDITION_TAG_CHECK': return { conditionType: 'TAG', tag: '' };
      case 'CONDITION_PLATFORM_CHECK': return { conditionType: 'PLATFORM', platform: 'FACEBOOK_PAGE' };
      case 'CONDITION_TIME_CHECK': return { conditionType: 'TIME', startTime: '09:00', endTime: '17:00' };
      case 'CONDITION_KEYWORD_CHECK': return { conditionType: 'KEYWORD', keywords: '' };
      default: return {};
    }
  };

  const confirm = useConfirm();
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editor View State
  const [isEditing, setIsEditing] = useState(false);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState(t("flowsPage.newFlowDefaultName"));
  const [flowDescription, setFlowDescription] = useState("");
  const [flowIsActive, setFlowIsActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Canvas Graph State
  const [nodes, setNodes] = useState<VisualNode[]>([]);
  const [connections, setConnections] = useState<VisualConnection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Pan & Zoom State
  const [panX, setPanX] = useState(100);
  const [panY, setPanY] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartPos, setPanStartPos] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number; nodeX: number; nodeY: number } | null>(null);

  // Click-to-Connect State
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; branchLabel: string } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Fetch all flows
  const fetchFlows = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/flows");
      setFlows(res.data);
    } catch (error) {
      console.error("Failed to fetch flows", error);
      setBanner({ type: "error", text: t("flowsPage.fetchFlowsFailed") });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlows();
  }, []);

  // Show banner timeout
  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => setBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  // Escape to cancel connection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConnectingFrom(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- SAVE & LOAD CONVERSIONS ---

  // Load a Flow into Editor
  const handleEditFlow = async (flow: Flow) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/flows/${flow.id}`);
      const fullFlow = res.data;

      setEditingFlowId(fullFlow.id);
      setFlowName(fullFlow.name);
      setFlowDescription(fullFlow.description || "");
      setFlowIsActive(fullFlow.isActive);

      // Map Triggers and Steps to Visual Nodes & Connections
      const visualNodes: VisualNode[] = [];
      const visualConnections: VisualConnection[] = [];

      // Map triggers
      if (fullFlow.triggers) {
        fullFlow.triggers.forEach((t: any) => {
          const config = t.configuration || {};
          const x = config.x !== undefined ? Number(config.x) : 80;
          const y = config.y !== undefined ? Number(config.y) : 150;
          
          let visualType = "TRIGGER_KEYWORD";
          if (t.type === "NEW_SUBSCRIBER") visualType = "TRIGGER_NEW_SUBSCRIBER";
          else if (t.type === "COMMENT") visualType = "TRIGGER_COMMENT";
          else if (t.type === "ANY_MESSAGE") visualType = "TRIGGER_ANY_MESSAGE";

          const nodeDef = NODE_TYPES[visualType as keyof typeof NODE_TYPES];

          visualNodes.push({
            id: t.id,
            type: visualType,
            category: "trigger",
            name: nodeDef?.name || t.type,
            x,
            y,
            configuration: {
              keywords: config.keywords || "",
              postId: config.postId || "",
            }
          });

          if (config.nextStepId) {
            visualConnections.push({
              id: generateUUID(),
              fromNodeId: t.id,
              fromBranchLabel: "next",
              toNodeId: config.nextStepId
            });
          }
        });
      }

      // Map steps
      if (fullFlow.steps) {
        fullFlow.steps.forEach((s: any) => {
          const meta = s.metadata || {};
          const config = s.configuration || {};
          
          const x = meta.x !== undefined ? Number(meta.x) : 380;
          const y = meta.y !== undefined ? Number(meta.y) : 150;

          let visualType = "ACTION_SEND_MESSAGE";
          if (s.type === "ADD_TAG") visualType = "ACTION_TAG_ADD";
          else if (s.type === "REMOVE_TAG") visualType = "ACTION_TAG_REMOVE";
          else if (s.type === "NOTIFY_TEAM") visualType = "ACTION_NOTIFY_TEAM";
          else if (s.type === "WAIT_DELAY") visualType = "ACTION_WAIT_DELAY";
          else if (s.type === "CONDITIONAL_BRANCH") {
            const condType = config.conditionType || "TAG";
            if (condType === "TAG") visualType = "CONDITION_TAG_CHECK";
            else if (condType === "PLATFORM") visualType = "CONDITION_PLATFORM_CHECK";
            else if (condType === "TIME") visualType = "CONDITION_TIME_CHECK";
            else if (condType === "KEYWORD") visualType = "CONDITION_KEYWORD_CHECK";
          }

          const nodeDef = NODE_TYPES[visualType as keyof typeof NODE_TYPES];

          visualNodes.push({
            id: s.id,
            type: visualType,
            category: (nodeDef?.category || "action") as 'trigger' | 'action' | 'condition',
            name: meta.name || nodeDef?.name || s.type,
            x,
            y,
            configuration: { ...config }
          });

          // Map branches as connections
          if (s.branches) {
            s.branches.forEach((b: any) => {
              if (b.nextStepId) {
                let fromBranchLabel = "next";
                if (s.type === "CONDITIONAL_BRANCH") {
                  const lbl = b.label.toLowerCase();
                  if (lbl === "yes" || lbl === "نعم") fromBranchLabel = "yes";
                  else if (lbl === "no" || lbl === "لا") fromBranchLabel = "no";
                }

                visualConnections.push({
                  id: generateUUID(),
                  fromNodeId: s.id,
                  fromBranchLabel,
                  toNodeId: b.nextStepId
                });
              }
            });
          }
        });
      }

      setNodes(visualNodes);
      setConnections(visualConnections);
      setSelectedNodeId(null);
      setPanX(100);
      setPanY(100);
      setZoom(1);
      setIsEditing(true);
    } catch (error) {
      console.error("Failed to load flow", error);
      setBanner({ type: "error", text: t("flowsPage.loadFlowDetailsFailed") });
    } finally {
      setIsLoading(false);
    }
  };

  // Create fresh new flow with templates
  const handleCreateNewFlow = () => {
    setEditingFlowId(null);
    setFlowName(t("flowsPage.autoFlowDefaultName"));
    setFlowDescription("");
    setFlowIsActive(false);

    // Initial default layout
    const triggerId = generateUUID();
    const actionId = generateUUID();

    const initialNodes: VisualNode[] = [
      {
        id: triggerId,
        type: "TRIGGER_KEYWORD",
        category: "trigger",
        name: NODE_TYPES.TRIGGER_KEYWORD.name,
        x: 100,
        y: 150,
        configuration: { keywords: t("flowsPage.demoKeywords") }
      },
      {
        id: actionId,
        type: "ACTION_SEND_MESSAGE",
        category: "action",
        name: NODE_TYPES.ACTION_SEND_MESSAGE.name,
        x: 450,
        y: 140,
        configuration: { text: t("flowsPage.demoSendMessageText"), mediaUrl: "" }
      }
    ];

    const initialConns: VisualConnection[] = [
      {
        id: generateUUID(),
        fromNodeId: triggerId,
        fromBranchLabel: "next",
        toNodeId: actionId
      }
    ];

    setNodes(initialNodes);
    setConnections(initialConns);
    setSelectedNodeId(null);
    setPanX(100);
    setPanY(100);
    setZoom(1);
    setIsEditing(true);
  };

  // Convert visual graph and save to NestJS
  const handleSaveFlow = async () => {
    if (!flowName.trim()) {
      setBanner({ type: "error", text: t("flowsPage.enterFlowNamePrompt") });
      return;
    }

    try {
      setIsSaving(true);

      // 1. Group visual nodes into triggers & steps
      const triggerNodes = nodes.filter(n => n.category === "trigger");
      const stepNodes = nodes.filter(n => n.category !== "trigger");

      // 2. Map triggers to DB representation
      const dbTriggers = triggerNodes.map(t => {
        let dbType = "KEYWORD";
        if (t.type === "TRIGGER_NEW_SUBSCRIBER") dbType = "NEW_SUBSCRIBER";
        else if (t.type === "TRIGGER_COMMENT") dbType = "COMMENT";
        else if (t.type === "TRIGGER_ANY_MESSAGE") dbType = "ANY_MESSAGE";

        // Find connection starting from this trigger node
        const conn = connections.find(c => c.fromNodeId === t.id);
        const nextStepId = conn ? conn.toNodeId : null;

        return {
          type: dbType,
          configuration: {
            ...t.configuration,
            x: t.x,
            y: t.y,
            nextStepId
          }
        };
      });

      // 3. Map steps to DB representation
      const dbSteps = stepNodes.map(s => {
        let dbType = "SEND_MESSAGE";
        if (s.type === "ACTION_TAG_ADD") dbType = "ADD_TAG";
        else if (s.type === "ACTION_TAG_REMOVE") dbType = "REMOVE_TAG";
        else if (s.type === "ACTION_NOTIFY_TEAM") dbType = "NOTIFY_TEAM";
        else if (s.type === "ACTION_WAIT_DELAY") dbType = "WAIT_DELAY";
        else if (s.type.startsWith("CONDITION_")) dbType = "CONDITIONAL_BRANCH";

        // Create branches matching the connections
        const branches = [];

        if (dbType === "CONDITIONAL_BRANCH") {
          // Yes branch
          const yesConn = connections.find(c => c.fromNodeId === s.id && c.fromBranchLabel === "yes");
          branches.push({
            label: "Yes",
            condition: { match: true },
            nextStepId: yesConn ? yesConn.toNodeId : null
          });

          // No branch
          const noConn = connections.find(c => c.fromNodeId === s.id && c.fromBranchLabel === "no");
          branches.push({
            label: "No",
            condition: { match: false },
            nextStepId: noConn ? noConn.toNodeId : null
          });
        } else {
          // Action nodes have exactly one "next" branch
          const conn = connections.find(c => c.fromNodeId === s.id && c.fromBranchLabel === "next");
          branches.push({
            label: "Next",
            condition: {},
            nextStepId: conn ? conn.toNodeId : null
          });
        }

        return {
          id: s.id, // Preserve UUID
          type: dbType,
          configuration: s.configuration,
          metadata: {
            x: s.x,
            y: s.y,
            name: s.name
          },
          branches
        };
      });

      const payload = {
        name: flowName,
        description: flowDescription,
        isActive: flowIsActive,
        triggers: dbTriggers,
        steps: dbSteps
      };

      if (editingFlowId) {
        await api.put(`/flows/${editingFlowId}`, payload);
        setBanner({ type: "success", text: t("flowsPage.flowSavedSuccess") });
      } else {
        const res = await api.post("/flows", payload);
        setEditingFlowId(res.data.id);
        setBanner({ type: "success", text: t("flowsPage.flowCreatedSuccess") });
      }

      fetchFlows();
    } catch (error) {
      console.error("Failed to save flow", error);
      setBanner({ type: "error", text: t("flowsPage.saveFlowFailed") });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Flow activation status from list
  const toggleFlowActive = async (flow: Flow) => {
    try {
      setFlows(flows.map(f => f.id === flow.id ? { ...f, isActive: !f.isActive } : f));
      await api.put(`/flows/${flow.id}/toggle`, { isActive: !flow.isActive });
      setBanner({ type: "success", text: !flow.isActive ? t("flowsPage.flowActivatedToast") : t("flowsPage.flowDeactivatedToast") });
    } catch (error) {
      console.error("Failed to toggle activation status", error);
      setBanner({ type: "error", text: t("flowsPage.toggleActivationFailed") });
      fetchFlows();
    }
  };

  // Delete Flow
  const handleDeleteFlow = async (flow: Flow) => {
    const confirmed = await confirm({
      title: t("flowsPage.deleteFlowConfirmTitle"),
      message: t("flowsPage.deleteFlowConfirmMessage", { name: flow.name }),
      confirmText: t("flowsPage.deleteNow"),
      cancelText: t("flowsPage.cancel"),
      variant: "destructive"
    });

    if (!confirmed) return;

    try {
      await api.delete(`/flows/${flow.id}`);
      setBanner({ type: "success", text: t("flowsPage.flowDeletedSuccess") });
      fetchFlows();
    } catch (error) {
      console.error("Failed to delete flow", error);
      setBanner({ type: "error", text: t("flowsPage.deleteFlowFailed") });
    }
  };

  // --- CANVAS HANDLERS ---

  // Standard heights for calculation of handle positions
  const getInputHandlePos = (node: VisualNode) => {
    const height = node.category === 'trigger' ? 80 : node.category === 'condition' ? 120 : 100;
    return {
      x: node.x,
      y: node.y + height / 2
    };
  };

  const getOutputHandlePos = (node: VisualNode, branchLabel: string) => {
    if (node.category === 'trigger' || node.category === 'action') {
      const height = node.category === 'trigger' ? 80 : 100;
      return {
        x: node.x + 240, // width
        y: node.y + height / 2
      };
    } else {
      // Conditions Yes/No
      const yOffset = branchLabel === 'yes' ? 45 : 85;
      return {
        x: node.x + 240,
        y: node.y + yOffset
      };
    }
  };

  const handleNodeDragStart = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;

    setDraggedNodeId(nodeId);
    setSelectedNodeId(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setDragStartPos({
        x: e.clientX,
        y: e.clientY,
        nodeX: node.x,
        nodeY: node.y
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeId && dragStartPos) {
      const dx = (e.clientX - dragStartPos.x) / zoom;
      const dy = (e.clientY - dragStartPos.y) / zoom;
      setNodes(prev => prev.map(n => {
        if (n.id === draggedNodeId) {
          return {
            ...n,
            x: Math.round(dragStartPos.nodeX + dx),
            y: Math.round(dragStartPos.nodeY + dy)
          };
        }
        return n;
      }));
    } else if (isPanning && panStartPos) {
      const dx = e.clientX - panStartPos.x;
      const dy = e.clientY - panStartPos.y;
      setPanX(panStartPos.panX + dx);
      setPanY(panStartPos.panY + dy);
    }

    if (connectingFrom && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left - panX) / zoom,
        y: (e.clientY - rect.top - panY) / zoom
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggedNodeId(null);
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).id === 'grid-bg') {
      setIsPanning(true);
      setPanStartPos({
        x: e.clientX,
        y: e.clientY,
        panX,
        panY
      });
      setSelectedNodeId(null);
    }
  };

  const handleOutputHandleClick = (e: React.MouseEvent, nodeId: string, branchLabel: string) => {
    e.stopPropagation();
    setConnectingFrom({ nodeId, branchLabel });
    
    // Set initial mouse position
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const pos = getOutputHandlePos(node, branchLabel);
      setMousePos(pos);
    }
  };

  const handleInputHandleClick = (e: React.MouseEvent, toNodeId: string) => {
    e.stopPropagation();
    if (connectingFrom) {
      const { nodeId: fromNodeId, branchLabel: fromBranchLabel } = connectingFrom;

      if (fromNodeId === toNodeId) {
        setConnectingFrom(null);
        return;
      }

      // Action nodes can only connect to one next step.
      // Triggers can also only connect to one next step.
      // Overwrite previous connections from this node + branch
      const newConn: VisualConnection = {
        id: generateUUID(),
        fromNodeId,
        fromBranchLabel,
        toNodeId
      };

      setConnections(prev => {
        const filtered = prev.filter(c => !(c.fromNodeId === fromNodeId && c.fromBranchLabel === fromBranchLabel));
        return [...filtered, newConn];
      });

      setConnectingFrom(null);
    }
  };

  // Drag sidebar items
  const handleDragStartPalette = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData("nodeType", type);
  };

  const handleDropCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("nodeType");
    if (!type) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = (e.clientX - rect.left - panX) / zoom;
    const localY = (e.clientY - rect.top - panY) / zoom;

    const nodeDef = NODE_TYPES[type as keyof typeof NODE_TYPES];
    if (!nodeDef) return;

    const newNode: VisualNode = {
      id: generateUUID(),
      type: nodeDef.type,
      category: nodeDef.category as 'trigger' | 'action' | 'condition',
      name: nodeDef.name,
      x: Math.round(localX - 120),
      y: Math.round(localY - 45),
      configuration: getInitialConfig(nodeDef.type)
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  // Delete node and its connections
  const handleDeleteNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  // Node configuration updates
  const handleUpdateConfig = (key: string, value: any) => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.map(n => {
      if (n.id === selectedNodeId) {
        return {
          ...n,
          configuration: {
            ...n.configuration,
            [key]: value
          }
        };
      }
      return n;
    }));
  };

  // Bezier curve calculations
  const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.max(80, Math.abs(x2 - x1) / 2);
    // Standard left-to-right Bezier curve
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return (
    <>
      {/* Global CSS for connection path animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes flow-pulse {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        .pulsing-edge {
          stroke-dasharray: 6, 6;
          animation: flow-pulse 1.5s linear infinite;
        }
        .neon-glow-cyan {
          box-shadow: 0 0 15px rgba(34, 211, 238, 0.4);
        }
        .neon-glow-teal {
          box-shadow: 0 0 15px rgba(77, 159, 255, 0.4);
        }
      `}} />

      {/* BANNER NOTIFICATION */}
      {banner && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 p-4 rounded-xl flex items-center gap-3 shadow-2xl transition-all duration-300 font-bold ${
          banner.type === "success" 
            ? "bg-emerald-950/90 border border-emerald-500 text-emerald-200 neon-glow-teal" 
            : "bg-red-950/90 border border-red-500 text-red-200"
        }`}>
          {banner.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* --- LIST VIEW --- */}
      {!isEditing && (
        <div className="flex flex-col gap-6" dir={dir}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <div className="bg-gradient-to-br from-primary to-[oklch(0.62_0.15_230)] p-2.5 rounded-xl shadow-lg shadow-primary/25">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                {t("flowsPage.title")}
              </h1>
              <p className="text-muted-foreground mt-2 font-medium">{t("flowsPage.subtitle")}</p>
            </div>
            <Button 
              onClick={handleCreateNewFlow}
              className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all rounded-xl px-6 h-11 font-bold cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              {t("flowsPage.createFlowBtn")}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : flows.length === 0 ? (
            <Card className="border border-border/50 bg-[#0d1117]/40 py-16 text-center rounded-2xl">
              <CardContent className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">{t("flowsPage.noFlowsTitle")}</h3>
                <p className="text-muted-foreground max-w-sm">{t("flowsPage.noFlowsDesc")}</p>
                <Button onClick={handleCreateNewFlow} className="mt-2 rounded-xl font-bold">
                  {t("flowsPage.createFirstFlowBtn")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {flows.map((flow) => (
                <Card key={flow.id} className="border border-border/50 bg-[#0d1117] hover:border-primary/40 transition-all duration-300 rounded-2xl relative overflow-hidden flex flex-col justify-between group">
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-l from-primary/0 via-primary/20 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <Badge className={`rounded-lg font-bold ${
                        flow.isActive 
                          ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/60" 
                          : "bg-muted text-muted-foreground hover:bg-muted"
                      }`}>
                        {flow.isActive ? t("flowsPage.activeBadge") : t("flowsPage.inactiveBadge")}
                      </Badge>
                      <Switch 
                        checked={flow.isActive}
                        onCheckedChange={() => toggleFlowActive(flow)}
                      />
                    </div>
                    <CardTitle className="text-lg font-black mt-3 text-right">{flow.name}</CardTitle>
                    <CardDescription className="text-sm font-medium line-clamp-2 text-right mt-1.5 h-10">
                      {flow.description || t("flowsPage.noDescriptionFallback")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 pb-5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-4 font-bold">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(flow.updatedAt).toLocaleDateString(localeCode)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{t("flowsPage.stepsCountLabel", { count: flow.steps?.length || 0 })}</span>
                        <span>{t("flowsPage.triggersCountLabel", { count: flow.triggers?.length || 0 })}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-5">
                      <Button 
                        variant="outline" 
                        onClick={() => handleEditFlow(flow)}
                        className="flex-1 rounded-xl font-bold h-10 border-primary/25 text-primary hover:bg-primary/5 cursor-pointer"
                      >
                        <Edit className="w-4 h-4 ml-1.5" />
                        {t("flowsPage.editFlowBtn")}
                      </Button>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleDeleteFlow(flow)}
                        className="rounded-xl h-10 w-10 text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- CANVAS EDITOR VIEW --- */}
      {isEditing && (
        <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-[600px] border border-border/50 bg-[#0a0a0f] rounded-2xl overflow-hidden relative" dir={dir}>
          
          {/* TOP CONTROL BAR */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/50 px-4 bg-[#0d1117] z-20">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setIsEditing(false);
                  fetchFlows();
                }}
                className="h-10 w-10 rounded-xl hover:bg-accent/40 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Input 
                  value={flowName} 
                  onChange={e => setFlowName(e.target.value)} 
                  placeholder={t("flowsPage.flowNamePlaceholder")} 
                  className="rounded-xl h-9 text-base font-black bg-accent/20 border-border/40 focus:border-primary/50 w-48 sm:w-64"
                />
                <span className="hidden sm:inline text-muted-foreground/30">|</span>
                <input
                  type="text"
                  value={flowDescription}
                  onChange={e => setFlowDescription(e.target.value)}
                  placeholder={t("flowsPage.flowDescPlaceholder")}
                  className="bg-transparent border-none text-xs text-muted-foreground outline-none w-48 font-medium sm:w-80 placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="active-toggle" className="text-xs font-bold text-muted-foreground">{t("flowsPage.activeLabel")}</Label>
                <Switch 
                  id="active-toggle" 
                  checked={flowIsActive}
                  onCheckedChange={setFlowIsActive}
                />
              </div>
              <Button 
                onClick={handleSaveFlow} 
                disabled={isSaving}
                className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/45 rounded-xl px-5 h-10 font-bold cursor-pointer"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t("flowsPage.saveChangesBtn")}
              </Button>
            </div>
          </header>

          {/* MAIN EDITOR GRID */}
          <div className="flex flex-1 relative overflow-hidden">

            {/* LEFT PALETTE SIDEBAR */}
            <aside className="w-64 border-l border-border/50 bg-[#0d1117] p-4 flex flex-col gap-5 overflow-y-auto shrink-0 select-none z-10">
              <div>
                <h4 className="text-xs font-black text-muted-foreground/70 uppercase tracking-wider mb-3">{t("flowsPage.triggersHeader")}</h4>
                <div className="flex flex-col gap-2">
                  {Object.entries(NODE_TYPES).filter(([_, n]) => n.category === 'trigger').map(([key, n]) => (
                    <div 
                      key={key}
                      draggable
                      onDragStart={(e) => handleDragStartPalette(e, key)}
                      className={`p-3 rounded-xl border ${n.color} hover:border-primary/60 cursor-grab active:cursor-grabbing transition-all text-xs font-bold flex items-center justify-between group shadow-sm`}
                    >
                      <span>{n.name}</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform shrink-0 mr-2" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-muted-foreground/70 uppercase tracking-wider mb-3">{t("flowsPage.actionsHeader")}</h4>
                <div className="flex flex-col gap-2">
                  {Object.entries(NODE_TYPES).filter(([_, n]) => n.category === 'action').map(([key, n]) => (
                    <div 
                      key={key}
                      draggable
                      onDragStart={(e) => handleDragStartPalette(e, key)}
                      className={`p-3 rounded-xl border ${n.color} hover:border-primary/60 cursor-grab active:cursor-grabbing transition-all text-xs font-bold flex items-center justify-between group shadow-sm`}
                    >
                      <span>{n.name}</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 group-hover:scale-125 transition-transform shrink-0 mr-2" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-muted-foreground/70 uppercase tracking-wider mb-3">{t("flowsPage.conditionsHeader")}</h4>
                <div className="flex flex-col gap-2">
                  {Object.entries(NODE_TYPES).filter(([_, n]) => n.category === 'condition').map(([key, n]) => (
                    <div 
                      key={key}
                      draggable
                      onDragStart={(e) => handleDragStartPalette(e, key)}
                      className={`p-3 rounded-xl border ${n.color} hover:border-primary/60 cursor-grab active:cursor-grabbing transition-all text-xs font-bold flex items-center justify-between group shadow-sm`}
                    >
                      <span>{n.name}</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 group-hover:scale-125 transition-transform shrink-0 mr-2" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto border-t border-border/40 pt-4 text-[10px] text-muted-foreground font-medium leading-relaxed">
                {t("flowsPage.canvasHint")}
              </div>
            </aside>

            {/* CENTER CANVAS CONTAINER */}
            <div 
              ref={canvasRef}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDropCanvas}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseDown={handleCanvasMouseDown}
              className="flex-1 relative overflow-hidden bg-[#07070b] cursor-grab active:cursor-grabbing select-none"
              style={{ direction: 'ltr' }} // Force standard coordinate scaling
            >
              {/* GRID BACKGROUND */}
              <div 
                id="grid-bg"
                className="absolute inset-0 transition-none pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(rgba(77, 159, 255, 0.08) 1.2px, transparent 0)`,
                  backgroundSize: '24px 24px',
                  backgroundPosition: `${panX}px ${panY}px`,
                  transform: `scale(${zoom})`,
                  transformOrigin: '0 0'
                }}
              />

              {/* TRANSFORMS GROUP (INNER CANVAS) */}
              <div 
                className="absolute transition-none"
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  width: '5000px',
                  height: '5000px',
                }}
              >
                {/* SVG CONNECTIONS LAYER */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  <defs>
                    <marker
                      id="arrow"
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#4d9fff" />
                    </marker>
                  </defs>

                  {/* Render saved connections */}
                  {connections.map((c) => {
                    const fromNode = nodes.find(n => n.id === c.fromNodeId);
                    const toNode = nodes.find(n => n.id === c.toNodeId);
                    if (!fromNode || !toNode) return null;

                    const start = getOutputHandlePos(fromNode, c.fromBranchLabel);
                    const end = getInputHandlePos(toNode);
                    const pathD = getBezierPath(start.x, start.y, end.x, end.y);

                    return (
                      <g key={c.id} className="group">
                        <path 
                          d={pathD} 
                          fill="none" 
                          stroke="#1e293b" 
                          strokeWidth="10" 
                          className="cursor-pointer pointer-events-auto opacity-0 group-hover:opacity-10 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConnections(prev => prev.filter(conn => conn.id !== c.id));
                          }}
                        />
                        <path 
                          d={pathD} 
                          fill="none" 
                          stroke="#4d9fff" 
                          strokeWidth="2.5" 
                          markerEnd="url(#arrow)"
                          className="pulsing-edge"
                        />
                      </g>
                    );
                  })}

                  {/* Connection preview line */}
                  {connectingFrom && mousePos && (() => {
                    const fromNode = nodes.find(n => n.id === connectingFrom.nodeId);
                    if (!fromNode) return null;

                    const start = getOutputHandlePos(fromNode, connectingFrom.branchLabel);
                    const pathD = getBezierPath(start.x, start.y, mousePos.x, mousePos.y);

                    return (
                      <path 
                        d={pathD} 
                        fill="none" 
                        stroke="#22d3ee" 
                        strokeWidth="2" 
                        strokeDasharray="5, 5"
                        className="animate-pulse"
                      />
                    );
                  })()}
                </svg>

                {/* NODES LAYER */}
                {nodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isTrigger = node.category === 'trigger';
                  const isCondition = node.category === 'condition';

                  // Calculate styles depending on node type
                  let typeHeaderBg = "bg-emerald-950/60 text-emerald-300 border-emerald-500/20";
                  if (node.category === 'action') typeHeaderBg = "bg-cyan-950/60 text-cyan-300 border-cyan-500/20";
                  else if (node.category === 'condition') typeHeaderBg = "bg-amber-950/60 text-amber-300 border-amber-500/20";

                  return (
                    <div
                      key={node.id}
                      onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                      className={`absolute w-60 rounded-xl border bg-[#0d1117] transition-all duration-150 z-10 cursor-grab active:cursor-grabbing ${
                        isSelected 
                          ? "border-primary neon-glow-teal ring-1 ring-primary/30" 
                          : "border-border hover:border-primary/45"
                      }`}
                      style={{
                        left: `${node.x}px`,
                        top: `${node.y}px`,
                      }}
                    >
                      {/* Node Header */}
                      <div className={`px-3 py-2 border-b rounded-t-xl flex justify-between items-center ${typeHeaderBg}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isTrigger ? <Zap className="w-3.5 h-3.5 shrink-0" /> : isCondition ? <HelpCircle className="w-3.5 h-3.5 shrink-0" /> : <Settings className="w-3.5 h-3.5 shrink-0" />}
                          <span className="text-xs font-black truncate">{node.name}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => handleDeleteNode(e, node.id)}
                          className="h-6 w-6 text-muted-foreground hover:text-red-400 hover:bg-red-950/40 rounded-md shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Node Content Preview */}
                      <div className="p-3 text-[11px] text-muted-foreground font-semibold space-y-1.5 text-right" style={{ direction: 'rtl' }}>
                        {node.type === 'TRIGGER_KEYWORD' && (
                          <p className="truncate">{t("flowsPage.keywordsPreviewLabel")} <span className="text-foreground">{node.configuration.keywords || t("flowsPage.noneFallback")}</span></p>
                        )}
                        {node.type === 'TRIGGER_COMMENT' && (
                          <p className="truncate">{t("flowsPage.postPreviewLabel")} <span className="text-foreground">{node.configuration.postId || t("flowsPage.allPostsFallback")}</span></p>
                        )}
                        {node.type === 'ACTION_SEND_MESSAGE' && (
                          <p className="line-clamp-2">{t("flowsPage.messagePreviewLabel")} <span className="text-foreground">{node.configuration.text || t("flowsPage.emptyFallback")}</span></p>
                        )}
                        {node.type === 'ACTION_TAG_ADD' && (
                          <p className="truncate">{t("flowsPage.tagPreviewLabel")} <span className="text-foreground">{node.configuration.tag || t("flowsPage.notSetFallback")}</span></p>
                        )}
                        {node.type === 'ACTION_TAG_REMOVE' && (
                          <p className="truncate">{t("flowsPage.removeTagPreviewLabel")} <span className="text-foreground">{node.configuration.tag || t("flowsPage.notSetFallback")}</span></p>
                        )}
                        {node.type === 'ACTION_WAIT_DELAY' && (
                          <p className="truncate">{t("flowsPage.waitPreviewLabel")} <span className="text-foreground">{node.configuration.delayAmount} {node.configuration.delayUnit === 'seconds' ? t("flowsPage.unitSeconds") : node.configuration.delayUnit === 'minutes' ? t("flowsPage.unitMinutes") : t("flowsPage.unitHours")}</span></p>
                        )}
                        {node.type === 'CONDITION_TAG_CHECK' && (
                          <p className="truncate">{t("flowsPage.tagCheckPreviewLabel")} <span className="text-foreground">{node.configuration.tag || t("flowsPage.notSetFallback")}</span></p>
                        )}
                        {node.type === 'CONDITION_PLATFORM_CHECK' && (
                          <p className="truncate">{t("flowsPage.platformPreviewLabel")} <span className="text-foreground">{node.configuration.platform === 'FACEBOOK_PAGE' ? t("flowsPage.platformFacebook") : node.configuration.platform === 'INSTAGRAM' ? t("flowsPage.platformInstagram") : t("flowsPage.platformWhatsapp")}</span></p>
                        )}
                        {node.type === 'CONDITION_TIME_CHECK' && (
                          <p className="truncate">{t("flowsPage.periodPreviewLabel")} <span className="text-foreground">{node.configuration.startTime} {t("flowsPage.toLabel")} {node.configuration.endTime}</span></p>
                        )}
                        {node.type === 'CONDITION_KEYWORD_CHECK' && (
                          <p className="truncate">{t("flowsPage.keywordsPreviewLabel")} <span className="text-foreground">{node.configuration.keywords || t("flowsPage.noneFallback")}</span></p>
                        )}
                      </div>

                      {/* INPUT HANDLE (Left Side) */}
                      {!isTrigger && (
                        <div 
                          onClick={(e) => handleInputHandleClick(e, node.id)}
                          className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 rounded-full bg-[#0a0a0f] border-2 border-primary flex items-center justify-center cursor-pointer hover:bg-primary hover:scale-125 transition-all z-20"
                          title={t("flowsPage.inputHandleTooltip")}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                        </div>
                      )}

                      {/* OUTPUT HANDLES (Right Side) */}
                      {isCondition ? (
                        // Condition Nodes have two branches (Yes / No)
                        <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around py-3 z-20">
                          {/* YES Outlet */}
                          <div className="relative flex items-center group/handle">
                            <div 
                              onClick={(e) => handleOutputHandleClick(e, node.id, "yes")}
                              className="w-4 h-4 rounded-full bg-[#0a0a0f] border-2 border-amber-500 flex items-center justify-center cursor-pointer hover:bg-amber-500 hover:scale-125 transition-all"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-[#0a0a0f]" />
                            </div>
                            <span className="absolute right-5 text-[9px] font-bold text-amber-500 pointer-events-none select-none bg-background/80 px-1 rounded border border-border/20">{t("flowsPage.yesBranchLabel")}</span>
                          </div>

                          {/* NO Outlet */}
                          <div className="relative flex items-center group/handle">
                            <div 
                              onClick={(e) => handleOutputHandleClick(e, node.id, "no")}
                              className="w-4 h-4 rounded-full bg-[#0a0a0f] border-2 border-red-500/80 flex items-center justify-center cursor-pointer hover:bg-red-500 hover:scale-125 transition-all"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-[#0a0a0f]" />
                            </div>
                            <span className="absolute right-5 text-[9px] font-bold text-red-400 pointer-events-none select-none bg-background/80 px-1 rounded border border-border/20">{t("flowsPage.noBranchLabel")}</span>
                          </div>
                        </div>
                      ) : (
                        // Trigger and Action Nodes have one output handle
                        <div 
                          onClick={(e) => handleOutputHandleClick(e, node.id, "next")}
                          className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 rounded-full bg-[#0a0a0f] border-2 border-primary flex items-center justify-center cursor-pointer hover:bg-primary hover:scale-125 transition-all z-20"
                          title={t("flowsPage.outputHandleTooltip")}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-[#0a0a0f]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* CANVAS CONTROLS (Bottom Left) */}
              <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-[#0d1117]/95 border border-border/40 p-1.5 rounded-xl z-20 shadow-xl" style={{ direction: 'rtl' }}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setZoom(prev => Math.min(1.5, prev + 0.1))}
                  className="h-8 w-8 hover:bg-accent/40 rounded-lg cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setZoom(prev => Math.max(0.6, prev - 0.1))}
                  className="h-8 w-8 hover:bg-accent/40 rounded-lg cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setZoom(1);
                    setPanX(100);
                    setPanY(100);
                  }}
                  className="h-8 w-8 hover:bg-accent/40 rounded-lg cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
                <span className="text-[10px] text-muted-foreground px-2 font-bold select-none">{Math.round(zoom * 100)}%</span>
              </div>
            </div>

            {/* RIGHT CONFIGURATION PANEL */}
            {selectedNode && (
              <aside className="w-80 border-r border-border/50 bg-[#0d1117] p-5 flex flex-col gap-6 overflow-y-auto shrink-0 z-10" dir={dir}>
                <div className="flex justify-between items-center border-b border-border/50 pb-3">
                  <h3 className="font-black text-base flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary" />
                    {t("flowsPage.stepSettingsTitle")}
                  </h3>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setSelectedNodeId(null)}
                    className="h-7 w-7 rounded-md cursor-pointer hover:bg-accent/50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Node title */}
                <div className="grid gap-2">
                  <Label htmlFor="node-name" className="font-bold text-xs">{t("flowsPage.stepNameLabel")}</Label>
                  <Input 
                    id="node-name"
                    value={selectedNode.name}
                    onChange={(e) => setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, name: e.target.value } : n))}
                    className="rounded-xl h-10 font-medium"
                  />
                </div>

                {/* --- TRIGGER CONFIGURATIONS --- */}
                {selectedNode.type === 'TRIGGER_KEYWORD' && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="keywords" className="font-bold text-xs">{t("flowsPage.keywordsFieldLabel")}</Label>
                      <Input 
                        id="keywords"
                        value={selectedNode.configuration.keywords || ''}
                        onChange={(e) => handleUpdateConfig('keywords', e.target.value)}
                        placeholder={t("flowsPage.keywordsFieldPlaceholder")}
                        className="rounded-xl h-10 font-medium"
                      />
                      <p className="text-[10px] text-muted-foreground font-semibold">{t("flowsPage.keywordTriggerHint")}</p>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'TRIGGER_COMMENT' && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="postId" className="font-bold text-xs">{t("flowsPage.specificPostLabel")}</Label>
                      <Input 
                        id="postId"
                        value={selectedNode.configuration.postId || ''}
                        onChange={(e) => handleUpdateConfig('postId', e.target.value)}
                        placeholder={t("flowsPage.specificPostPlaceholder")}
                        className="rounded-xl h-10 font-medium"
                      />
                      <p className="text-[10px] text-muted-foreground font-semibold">{t("flowsPage.specificPostHint")}</p>
                    </div>
                  </div>
                )}

                {/* --- ACTION CONFIGURATIONS --- */}
                {selectedNode.type === 'ACTION_SEND_MESSAGE' && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="msg-text" className="font-bold text-xs">{t("flowsPage.messageContentLabel")}</Label>
                      <Textarea 
                        id="msg-text"
                        value={selectedNode.configuration.text || ''}
                        onChange={(e) => handleUpdateConfig('text', e.target.value)}
                        placeholder={t("flowsPage.messageContentPlaceholder")}
                        className="rounded-xl min-h-[120px] font-medium"
                      />
                      <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed">
                        {t("flowsPage.spinTaxHint").split("|||").map((part, i, arr) => i < arr.length - 1 ? <span key={i}>{part}<code>|||</code></span> : <span key={i}>{part}</span>)}
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="media-url" className="font-bold text-xs">{t("flowsPage.mediaUrlOptionalLabel")}</Label>
                      <Input 
                        id="media-url"
                        value={selectedNode.configuration.mediaUrl || ''}
                        onChange={(e) => handleUpdateConfig('mediaUrl', e.target.value)}
                        placeholder="https://example.com/image.png"
                        className="rounded-xl h-10 font-medium"
                      />
                    </div>
                  </div>
                )}

                {(selectedNode.type === 'ACTION_TAG_ADD' || selectedNode.type === 'ACTION_TAG_REMOVE') && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="tag-name" className="font-bold text-xs">{t("flowsPage.tagNameLabel")}</Label>
                      <Input 
                        id="tag-name"
                        value={selectedNode.configuration.tag || ''}
                        onChange={(e) => handleUpdateConfig('tag', e.target.value)}
                        placeholder={t("flowsPage.tagNamePlaceholder")}
                        className="rounded-xl h-10 font-medium"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.type === 'ACTION_NOTIFY_TEAM' && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="notify-msg" className="font-bold text-xs">{t("flowsPage.notifyMessageLabel")}</Label>
                      <Input 
                        id="notify-msg"
                        value={selectedNode.configuration.message || ''}
                        onChange={(e) => handleUpdateConfig('message', e.target.value)}
                        placeholder={t("flowsPage.notifyMessagePlaceholder")}
                        className="rounded-xl h-10 font-medium"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.type === 'ACTION_WAIT_DELAY' && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="delay-amt" className="font-bold text-xs">{t("flowsPage.waitDurationLabel")}</Label>
                      <Input 
                        id="delay-amt"
                        type="number"
                        min="1"
                        value={selectedNode.configuration.delayAmount || 5}
                        onChange={(e) => handleUpdateConfig('delayAmount', Number(e.target.value))}
                        className="rounded-xl h-10 font-medium"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="delay-unit" className="font-bold text-xs">{t("flowsPage.timeUnitLabel")}</Label>
                      <Select 
                        value={selectedNode.configuration.delayUnit || 'minutes'}
                        onValueChange={(val) => handleUpdateConfig('delayUnit', val)}
                        items={{ seconds: t("flowsPage.unitSeconds"), minutes: t("flowsPage.unitMinutes"), hours: t("flowsPage.unitHours"), days: t("flowsPage.unitDays") }}
                      >
                        <SelectTrigger id="delay-unit" className="rounded-xl h-10 font-medium">
                          <SelectValue placeholder={t("flowsPage.selectUnitPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl font-bold" dir={dir}>
                          <SelectItem value="seconds">{t("flowsPage.unitSeconds")}</SelectItem>
                          <SelectItem value="minutes">{t("flowsPage.unitMinutes")}</SelectItem>
                          <SelectItem value="hours">{t("flowsPage.unitHours")}</SelectItem>
                          <SelectItem value="days">{t("flowsPage.unitDays")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* --- CONDITION CONFIGURATIONS --- */}
                {selectedNode.type === 'CONDITION_TAG_CHECK' && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="cond-tag" className="font-bold text-xs">{t("flowsPage.tagToCheckLabel")}</Label>
                      <Input 
                        id="cond-tag"
                        value={selectedNode.configuration.tag || ''}
                        onChange={(e) => handleUpdateConfig('tag', e.target.value)}
                        placeholder={t("flowsPage.tagNamePlaceholder")}
                        className="rounded-xl h-10 font-medium"
                      />
                      <p className="text-[10px] text-muted-foreground font-semibold">{t("flowsPage.tagCheckHint")}</p>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'CONDITION_PLATFORM_CHECK' && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="cond-platform" className="font-bold text-xs">{t("flowsPage.platformToCheckLabel")}</Label>
                      <Select 
                        value={selectedNode.configuration.platform || 'FACEBOOK_PAGE'}
                        onValueChange={(val) => handleUpdateConfig('platform', val)}
                        items={{ FACEBOOK_PAGE: t("flowsPage.platformFacebook"), INSTAGRAM: t("flowsPage.platformInstagram"), WHATSAPP: t("flowsPage.platformWhatsapp") }}
                      >
                        <SelectTrigger id="cond-platform" className="rounded-xl h-10 font-medium">
                          <SelectValue placeholder={t("flowsPage.selectPlatformPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl font-bold" dir={dir}>
                          <SelectItem value="FACEBOOK_PAGE">{t("flowsPage.platformFacebook")}</SelectItem>
                          <SelectItem value="INSTAGRAM">{t("flowsPage.platformInstagram")}</SelectItem>
                          <SelectItem value="WHATSAPP">{t("flowsPage.platformWhatsapp")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'CONDITION_TIME_CHECK' && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="start-time" className="font-bold text-xs">{t("flowsPage.startTimeLabel")}</Label>
                      <Input 
                        id="start-time"
                        type="time"
                        value={selectedNode.configuration.startTime || '09:00'}
                        onChange={(e) => handleUpdateConfig('startTime', e.target.value)}
                        className="rounded-xl h-10 font-medium"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="end-time" className="font-bold text-xs">{t("flowsPage.endTimeLabel")}</Label>
                      <Input 
                        id="end-time"
                        type="time"
                        value={selectedNode.configuration.endTime || '17:00'}
                        onChange={(e) => handleUpdateConfig('endTime', e.target.value)}
                        className="rounded-xl h-10 font-medium"
                      />
                      <p className="text-[10px] text-muted-foreground font-semibold">{t("flowsPage.timeCheckHint")}</p>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'CONDITION_KEYWORD_CHECK' && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="cond-keywords" className="font-bold text-xs">{t("flowsPage.keywordCheckLabel")}</Label>
                      <Input 
                        id="cond-keywords"
                        value={selectedNode.configuration.keywords || ''}
                        onChange={(e) => handleUpdateConfig('keywords', e.target.value)}
                        placeholder={t("flowsPage.keywordCheckPlaceholder")}
                        className="rounded-xl h-10 font-medium"
                      />
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>
      )}
    </>
  );
}
