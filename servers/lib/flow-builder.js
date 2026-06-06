// Port of the deterministic, non-LLM parts of flow_builder.py.
//
// Claude does the creative work (decides nodes, edges, blocks, which tools to
// attach, prompt text, capture variables). This module turns that blueprint
// into the exact JSON shapes the Phinite platform stores.
//
// What gets generated here (no LLM calls):
//   - React Flow node positions (start, end, task/child layout)
//   - React Flow edge objects with bidirectional flags for child connections
//   - block_content entries: orchestration_model, capture_variables, input_variables
//   - predefined_tool_entry from Claude-supplied predefined tool refs
//
// Custom code-tool creation is handled in tools/create-flow.js via the registry
// REST API — same POST /tool + PUT /tool/{id} sequence used by the copilot.

const crypto = require('crypto');

const TYPE_MAP = {
  string:  'String',
  integer: 'Integer',
  number:  'Number',
  boolean: 'Boolean',
  array:   'Array',
  object:  'Object',
};

function randomId(min = 1e12, max = 1e13 - 1) {
  return Math.floor(min + Math.random() * (max - min));
}

// ─── Node positioning ────────────────────────────────────────────────────────
// Port of nodes_tool_args from flow_builder.py. Lays out start on the left,
// end on the right, and tasks spread between with a slight zigzag for ≤4,
// two rows for ≤8, and a grid beyond that.
function buildNodes(blueprintNodes) {
  const nodes = [];
  const taskArgs = blueprintNodes.filter((n) => n.id !== 'start' && n.id !== 'end');

  let startX = 150, startY = 300, endX = 1800, endY = 300;
  const numTasks = taskArgs.length;
  const taskPositions = [];

  if (numTasks === 1) {
    endX = 1100;
    taskPositions.push([(startX + endX) / 2 | 0, startY]);
  } else if (numTasks <= 4) {
    const spacingX = ((endX - startX - 800) / (numTasks + 1)) | 0;
    const zigzag = 60;
    for (let i = 0; i < numTasks; i++) {
      const x = startX + 400 + i * spacingX;
      const y = startY + (i % 2 === 0 ? -zigzag : zigzag);
      taskPositions.push([x, y]);
    }
  } else if (numTasks <= 8) {
    const tasksPerRow = ((numTasks + 1) / 2) | 0;
    const rowSpacing = 300;
    for (let i = 0; i < numTasks; i++) {
      const row = (i / tasksPerRow) | 0;
      const col = i % tasksPerRow;
      const currentRowTasks = Math.min(tasksPerRow, numTasks - row * tasksPerRow);
      const spacingX = ((endX - startX - 400) / (currentRowTasks + 1)) | 0;
      const x = startX + 400 + col * spacingX;
      const y = startY + row * rowSpacing - (rowSpacing / 2 | 0);
      taskPositions.push([x, y]);
    }
  } else {
    const cols = Math.min(4, Math.floor(Math.sqrt(numTasks)) + 1);
    const rows = Math.ceil(numTasks / cols);
    const spacingX = ((endX - startX - 400) / (cols + 1)) | 0;
    const spacingY = 250;
    const startGridY = startY - ((rows - 1) * spacingY / 2 | 0);
    for (let i = 0; i < numTasks; i++) {
      const row = (i / cols) | 0;
      const col = i % cols;
      let x;
      if (row === rows - 1) {
        const itemsLast = numTasks - row * cols;
        const offset = itemsLast < cols ? ((cols - itemsLast) * spacingX / 2 | 0) : 0;
        x = startX + 400 + col * spacingX + offset;
      } else {
        x = startX + 400 + col * spacingX;
      }
      const y = startGridY + row * spacingY;
      taskPositions.push([x, y]);
    }
  }

  let taskIdx = 0;
  for (const arg of blueprintNodes) {
    if (arg.id === 'start') {
      nodes.push({
        id: 'start',
        position: { x: startX, y: startY },
        data: { label: 'Start', deletable: false },
        type: 'start',
        draggable: false,
        width: 96, height: 30,
        positionAbsolute: { x: startX, y: startY },
      });
    } else if (arg.id === 'end') {
      nodes.push({
        id: 'end',
        position: { x: endX, y: endY },
        data: { label: '', deletable: true },
        type: 'end',
        draggable: false,
        width: 96, height: 30,
        selected: false,
        positionAbsolute: { x: endX, y: endY },
        dragging: false,
      });
    } else {
      const [x, y] = taskPositions[taskIdx++];
      nodes.push({
        id: arg.id,
        position: { x, y },
        data: { label: arg.task, deletable: true },
        type: arg.type || 'task',
        draggable: true,
        width: 250, height: 100,
        selected: false,
        positionAbsolute: { x, y },
        dragging: false,
      });
    }
  }
  return nodes;
}

// ─── Edge construction ───────────────────────────────────────────────────────
// Port of edges_tool_args from flow_builder.py.
//
// Child↔master edges MUST go parent → child (master is the caller, child is
// the callee). Blueprints sometimes list these as child → master — we silently
// flip them here so the platform always receives the correct direction.
// Only flip when source is a child AND target is a task (master) node; edges
// to/from start, end, or another child are left as-is.
function buildEdges(blueprintEdges, builtNodes) {
  const childIds = new Set(builtNodes.filter((n) => n.type === 'child').map((n) => n.id));
  const taskIds  = new Set(builtNodes.filter((n) => n.type === 'task').map((n) => n.id));

  return (blueprintEdges || []).map((edge) => {
    const [source, target, label] = edge;

    // If the blueprint says child → master, flip to master → child.
    const needsFlip  = childIds.has(source) && taskIds.has(target);
    const src        = needsFlip ? target : source;
    const tgt        = needsFlip ? source : target;

    return {
      source:       src,
      sourceHandle: 'right',
      target:       tgt,
      targetHandle: null,
      type: 'custom',
      id: `reactflow__edge-${src}-${tgt}`,
      data: {
        label: label || '',
        bidirectionalArrows: childIds.has(source) || childIds.has(target),
      },
    };
  });
}

// ─── Predefined tool block ───────────────────────────────────────────────────
// Build the platform-shaped entry for ONE predefined tool reference that
// Claude has decided to attach. Claude must supply at least `name` and
// `operation`; everything else falls back to sensible defaults.
//
// Shape of Claude's input (per tool):
//   {
//     "name":           "firecrawl",            // required
//     "operation":      "scrape",               // required
//     "description":    "Scrape a page",        // optional, shown to LLM
//     "icon_url":       "https://...",          // optional
//     "tool_id":        "firecrawl_001",        // optional
//     "sub_tool_id":    "auto-generated if missing",
//     "inputs":         { "firecrawl.scrape.url": { type: "string", description: "..." } },
//     "outputs":        ["firecrawl.scrape.output.html", ...],
//     "schema":         { ... raw op schema from Phinite catalogue, if known ... }
//   }
function buildPredefinedToolBlock(toolRef) {
  const {
    name        = '',
    operation   = '',
    description = '',
    icon_url    = '',
    tool_id     = name ? `${name}001` : '',
    sub_tool_id = String(randomId()),
    inputs      = {},
    outputs     = [],
    schema      = {},
  } = toolRef || {};

  if (!name)      throw new Error('predefined tool: "name" is required');
  if (!operation) throw new Error(`predefined tool '${name}': "operation" is required`);

  const captureVars = Object.entries(inputs).map(([inputKey, meta]) => {
    const rawType = (meta?.type || 'string').toLowerCase();
    return {
      id:             randomId(),
      name:           inputKey,
      type:           TYPE_MAP[rawType] || 'String',
      variableType:   'ai-derived',
      value:          '',
      notes:          '',
      llmDescription: meta?.description || description,
      iconUrl:        icon_url,
    };
  });

  return {
    predefined_tool_entry: {
      name,
      iconUrl: icon_url,
      type:    name,
      id:      tool_id,
      subCategory: 'predefined-tools',
      subTools: [{ id: sub_tool_id, name: operation, tool_id, schema }],
      connectionDetails: {},
    },
    capture_variables: captureVars,
    output_keys: outputs,
  };
}

// ─── Block content ───────────────────────────────────────────────────────────
// Build one block_content entry (task agent OR child agent) from Claude's
// block blueprint plus the custom-tool IDs already created by the API call.
//
// Claude's block input shape:
//   {
//     "id":                "<node id>",
//     "name":              "Customer Intake Agent",
//     "agent_prompt":      "<long prompt text>",
//     "input_variables":   ["foo", "bar"],
//     "capture_variables": { "var_name": "description for LLM extraction", ... },
//     "predefined_tools":  [ <toolRef as above>, ... ],
//     "custom_tool_ids":   [ "id1", "id2" ],   // filled in by create-flow.js
//     "llm_tool_description": "...",            // child agents only
//     "resource":  "text|image|video|audio|document",  // child agents only
//     "operation": "analysis|generation",       // child agents only
//   }
function buildBlockContent(block, { workspaceId, nodeType }) {
  const isChild = nodeType === 'child';

  // Capture vars from Claude's plain {name: description} mapping.
  const llmCaptureVars = Object.entries(block.capture_variables || {}).map(
    ([varName, varDesc]) => ({
      id:             randomId(),
      name:           varName,
      type:           'String',
      llmDescription: varDesc,
      variableType:   'ai-derived',
    }),
  );

  // Capture vars contributed by attached predefined tools.
  const predefinedTools  = [];
  const predefinedCapture = [];
  const predefinedOutputs = [];
  for (const toolRef of (block.predefined_tools || [])) {
    const built = buildPredefinedToolBlock(toolRef);
    predefinedTools.push(built.predefined_tool_entry);
    predefinedCapture.push(...built.capture_variables);
    predefinedOutputs.push(...built.output_keys);
  }
  const allCaptureVars = llmCaptureVars.concat(predefinedCapture);

  // Filter out input vars that are already produced by predefined tools.
  const inputVars = (block.input_variables || [])
    .filter((v) => !predefinedOutputs.includes(v))
    .map((varName) => ({ id: randomId(), name: varName, type: 'String' }));

  // Orchestration model — picked from resource + operation for child agents.
  let modelName = 'gpt-4.1';
  if (isChild) {
    if (block.operation === 'analysis') {
      modelName = block.resource === 'text' ? 'gpt-4.1' : 'gemini-2.5-pro';
    } else if (block.operation === 'generation') {
      modelName = {
        image: 'imagen-4.0-fast-generate-001',
        video: 'veo-3.1-fast-generate-001',
        text:  'gpt-4.1',
      }[block.resource] || 'gpt-4.1';
    }
  }

  const orchestrationModel = {
    modelName,
    resource:    isChild ? (block.resource || 'text')      : 'text',
    operation:   isChild ? (block.operation || 'analysis') : 'analysis',
    apiKeyName:  'Phinite Api',
    envencryptid: null,
    createdAt:   new Date().toISOString(),
    workspaceId,
  };

  const details = isChild
    ? {
        name: block.name,
        type: 'child agent',
        task_prompt: block.agent_prompt,
        tools: block.custom_tool_ids || [],
        predefinedTools,
        llm_tool_description: block.llm_tool_description || '',
        orchestration_model: orchestrationModel,
        child_variables: { capture_variables: allCaptureVars, input_variables: inputVars },
        datasource_items: [],
        decision_variable: [],
        dataSourceDetails: [],
      }
    : {
        name: block.name,
        type: 'task agent',
        task_prompt: block.agent_prompt,
        tools: block.custom_tool_ids || [],
        predefinedTools,
        orchestration_model: orchestrationModel,
        capture_variables: allCaptureVars,
        input_variables: inputVars,
        datasource_items: [],
        decision_variable: [],
        dataSourceDetails: [],
      };

  return { id: block.id, type: isChild ? 'child' : 'task', details };
}

// ─── Top-level transform ─────────────────────────────────────────────────────
// Takes Claude's whole blueprint and returns the JSON shape ready to PUT
// to /flow_V2/update/{flow_id}.
function buildFlowPayload(blueprint, { workspaceId }) {
  const { name, description, nodes, edges, blocks } = blueprint;
  if (!name)        throw new Error('flow.name is required');
  if (!description) throw new Error('flow.description is required');
  if (!Array.isArray(nodes) || !nodes.length) throw new Error('flow.nodes is required');

  const builtNodes = buildNodes(nodes);
  const builtEdges = buildEdges(edges || [], builtNodes);

  const nodeTypeById = new Map(nodes.map((n) => [n.id, n.type || 'task']));
  const blockEntries = (blocks || []).map((b) =>
    buildBlockContent(b, { workspaceId, nodeType: nodeTypeById.get(b.id) || 'task' })
  );

  // Wrap with start/end sentinels (mirrors flow_builder.py).
  const blockContent = [
    { id: 'start', type: 'start' },
    ...blockEntries,
    { id: 'end',   type: 'end' },
  ];

  return {
    name,
    description,
    nodes: builtNodes,
    edges: builtEdges,
    blocks_content: blockContent,
  };
}

module.exports = {
  buildFlowPayload,
  buildNodes,
  buildEdges,
  buildPredefinedToolBlock,
  buildBlockContent,
};
