import { useMemo, useState } from "react";

// --- Sample data: a student's knowledge tree -------------------------------
// Mastery is 0-100. Internal (subject/topic) nodes carry a rolled-up score;
// leaf nodes are the individually-tested sub-topics.
const TREE_DATA = {
  id: "root",
  name: "Your knowledge tree",
  children: [
    {
      id: "ds",
      name: "Data Structures",
      mastery: 68,
      children: [
        {
          id: "ds-trees",
          name: "Trees & Balancing",
          mastery: 74,
          children: [
            { id: "ds-avl", name: "AVL Rotations", mastery: 82 },
            { id: "ds-bst", name: "BST Operations", mastery: 88 },
            { id: "ds-heap", name: "Heaps & Priority Queues", mastery: 55 },
          ],
        },
        {
          id: "ds-graph",
          name: "Graphs",
          mastery: 61,
          children: [
            { id: "ds-dfs", name: "DFS / BFS", mastery: 90 },
            { id: "ds-dij", name: "Dijkstra's Algorithm", mastery: 45 },
            { id: "ds-mst", name: "Minimum Spanning Trees", mastery: 48 },
          ],
        },
        {
          id: "ds-dp",
          name: "Dynamic Programming",
          mastery: 58,
          children: [
            { id: "ds-knap", name: "Knapsack Variants", mastery: 52 },
            { id: "ds-lcs", name: "LCS / Edit Distance", mastery: 64 },
          ],
        },
      ],
    },
    {
      id: "os",
      name: "Operating Systems",
      mastery: 41,
      children: [
        {
          id: "os-sched",
          name: "Scheduling",
          mastery: 58,
          children: [
            { id: "os-rr", name: "Round Robin", mastery: 71 },
            { id: "os-prio", name: "Priority Scheduling", mastery: 45 },
          ],
        },
        {
          id: "os-sync",
          name: "Synchronization",
          mastery: 33,
          children: [
            { id: "os-bank", name: "Banker's Algorithm", mastery: 34 },
            { id: "os-dead", name: "Deadlock Avoidance", mastery: 28 },
            { id: "os-sem", name: "Semaphores", mastery: 61 },
          ],
        },
      ],
    },
    {
      id: "db",
      name: "Databases",
      mastery: 79,
      children: [
        {
          id: "db-design",
          name: "Schema Design",
          mastery: 85,
          children: [
            { id: "db-norm", name: "Normalization (3NF)", mastery: 91 },
            { id: "db-er", name: "ER Modeling", mastery: 80 },
          ],
        },
        {
          id: "db-query",
          name: "Query Optimization",
          mastery: 70,
          children: [
            { id: "db-idx", name: "Indexing Strategies", mastery: 72 },
            { id: "db-join", name: "Join Algorithms", mastery: 68 },
          ],
        },
      ],
    },
    {
      id: "net",
      name: "Networks",
      mastery: 52,
      children: [
        {
          id: "net-transport",
          name: "Transport Layer",
          mastery: 50,
          children: [
            { id: "net-tcp", name: "TCP Congestion Control", mastery: 47 },
            { id: "net-udp", name: "UDP vs TCP", mastery: 66 },
          ],
        },
        {
          id: "net-routing",
          name: "Routing",
          mastery: 54,
          children: [
            { id: "net-bgp", name: "BGP Basics", mastery: 40 },
            { id: "net-ospf", name: "OSPF", mastery: 58 },
          ],
        },
      ],
    },
  ],
};

const X_SPACING = 210;
const Y_SPACING = 46;
const MARGIN_LEFT = 30;
const MARGIN_TOP = 24;
const MARGIN_BOTTOM = 24;

function radiusForDepth(depth) {
  if (depth === 0) return 5;
  if (depth === 1) return 13;
  if (depth === 2) return 9;
  return 6.5;
}

function fontSizeForDepth(depth) {
  if (depth === 1) return 14;
  if (depth === 2) return 12;
  return 11.5;
}

function colorForMastery(mastery) {
  if (mastery === undefined) return "#8B9A8C";
  if (mastery >= 75) return "#2F6B4F"; // mastered
  if (mastery >= 50) return "#7A9B6E"; // developing
  return "#E2A73E"; // needs practice
}

function statusForMastery(mastery) {
  if (mastery === undefined) return "Not yet assessed";
  if (mastery >= 75) return "Mastered";
  if (mastery >= 50) return "Developing";
  return "Needs practice";
}

function containsMatch(node, query) {
  if (!query) return false;
  if (node.name.toLowerCase().includes(query.toLowerCase())) return true;
  return (node.children || []).some((c) => containsMatch(c, query));
}

function countLeaves(node) {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

export default function TopicTree({ data = TREE_DATA }) {
  const [collapsed, setCollapsed] = useState(() => {
    // Start with subjects visible, their topics collapsed, for a clean first view.
    const ids = new Set();
    (data.children || []).forEach((subject) => {
      (subject.children || []).forEach((topic) => ids.add(topic.id));
    });
    return ids;
  });
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");

  function toggle(id) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  function collapseAll() {
    const ids = new Set();
    (data.children || []).forEach((subject) => {
      ids.add(subject.id);
    });
    setCollapsed(ids);
  }

  const { nodes, edges, width, height, byId, pathById } = useMemo(() => {
    const nodesOut = [];
    const edgesOut = [];
    const byIdMap = new Map();
    const pathMap = new Map();
    let yCounter = 0;
    let maxDepth = 0;

    function effectiveCollapsed(node) {
      if (!node.children || node.children.length === 0) return true;
      if (query) return !containsMatch(node, query);
      return collapsed.has(node.id);
    }

    function walk(node, depth, path) {
      maxDepth = Math.max(maxDepth, depth);
      const isLeafForLayout = effectiveCollapsed(node);
      let yIndex;
      if (isLeafForLayout) {
        yIndex = yCounter;
        yCounter += 1;
      } else {
        const childYs = node.children.map((c) => walk(c, depth + 1, [...path, node.id]));
        yIndex = (childYs[0] + childYs[childYs.length - 1]) / 2;
      }
      const px = MARGIN_LEFT + depth * X_SPACING;
      const py = MARGIN_TOP + yIndex * Y_SPACING;
      const hasChildren = Boolean(node.children && node.children.length);
      const isOpen = hasChildren && !isLeafForLayout;
      const entry = {
        id: node.id,
        name: node.name,
        mastery: node.mastery,
        depth,
        px,
        py,
        hasChildren,
        isOpen,
        leafCount: hasChildren ? countLeaves(node) : null,
        matched: Boolean(query) && node.name.toLowerCase().includes(query.toLowerCase()),
      };
      nodesOut.push(entry);
      byIdMap.set(node.id, entry);
      pathMap.set(node.id, [...path, node.id]);

      if (isOpen) {
        node.children.forEach((child) => {
          edgesOut.push({ id: `${node.id}->${child.id}`, from: entry, toId: child.id });
        });
      }
      return yIndex;
    }

    walk(data, 0, []);

    // Resolve edge target refs now that all nodes are placed.
    const resolvedEdges = edgesOut.map((e) => ({ ...e, to: byIdMap.get(e.toId) })).filter((e) => e.to);

    const widthOut = MARGIN_LEFT + maxDepth * X_SPACING + 240;
    const heightOut = MARGIN_TOP + yCounter * Y_SPACING + MARGIN_BOTTOM;

    return { nodes: nodesOut, edges: resolvedEdges, width: widthOut, height: heightOut, byId: byIdMap, pathById: pathMap };
  }, [data, collapsed, query]);

  const selected = selectedId ? byId.get(selectedId) : null;
  const breadcrumb = selectedId ? (pathById.get(selectedId) || []).map((id) => byId.get(id)?.name).filter(Boolean) : [];

  function handleActivate(node) {
    setSelectedId(node.id);
    if (node.hasChildren) toggle(node.id);
  }

  return (
    <div className="font-body">
      <style>{`
        .tree-node { cursor: pointer; }
        .tree-node:focus-visible { outline: 2px solid #2F6B4F; outline-offset: 4px; }
        .tree-node:hover circle.node-circle { filter: brightness(1.08); }
      `}</style>

      {/* Toolbar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 text-xs" style={{ color: "#3D4A40" }}>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2F6B4F" }} />
            Mastered (75%+)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#7A9B6E" }} />
            Developing
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#E2A73E" }} />
            Needs practice
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a topic..."
            className="rounded-full border bg-white px-4 py-1.5 text-xs"
            style={{ borderColor: "#D8DED4", color: "#14231C" }}
          />
          <button
            onClick={expandAll}
            className="rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-70"
            style={{ borderColor: "#D8DED4", color: "#3D4A40" }}
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-70"
            style={{ borderColor: "#D8DED4", color: "#3D4A40" }}
          >
            Collapse all
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Tree canvas */}
        <div
          className="overflow-x-auto rounded-2xl border"
          style={{ borderColor: "#D8DED4", background: "#FFFFFF" }}
        >
          <svg width={width} height={height} role="tree" aria-label="Knowledge tree" style={{ display: "block" }}>
            {edges.map((e) => {
              const x1 = e.from.px + radiusForDepth(e.from.depth);
              const y1 = e.from.py;
              const x2 = e.to.px - radiusForDepth(e.to.depth);
              const y2 = e.to.py;
              const mx = (x1 + x2) / 2;
              return (
                <path
                  key={e.id}
                  d={`M ${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke="#D8DED4"
                  strokeWidth={1.5}
                />
              );
            })}

            {nodes.map((n) => {
              const r = radiusForDepth(n.depth);
              const fill = n.depth === 0 ? "#8B9A8C" : colorForMastery(n.mastery);
              const isSelected = n.id === selectedId;
              return (
                <g
                  key={n.id}
                  className="tree-node"
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.name}${n.mastery !== undefined ? `, ${n.mastery}% mastery` : ""}`}
                  transform={`translate(${n.px}, ${n.py})`}
                  onClick={() => handleActivate(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleActivate(n);
                    }
                  }}
                >
                  {isSelected && <circle className="node-circle" r={r + 4} fill="none" stroke="#14231C" strokeWidth={1.5} />}
                  {n.matched && !isSelected && (
                    <circle className="node-circle" r={r + 4} fill="none" stroke="#E2A73E" strokeWidth={1.5} />
                  )}
                  <circle className="node-circle" r={r} fill={fill} />
                  {n.hasChildren && n.depth > 0 && (
                    <text
                      x={0}
                      y={3.5}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#FFFFFF"
                      fontFamily="'IBM Plex Mono', monospace"
                      pointerEvents="none"
                    >
                      {n.isOpen ? "\u2212" : "+"}
                    </text>
                  )}
                  {n.depth > 0 && (
                    <text
                      x={r + 8}
                      y={4}
                      fontSize={fontSizeForDepth(n.depth)}
                      fontWeight={n.depth === 1 ? 600 : 500}
                      fill="#14231C"
                      fontFamily="'Inter', sans-serif"
                      pointerEvents="none"
                    >
                      {n.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Detail panel */}
        <div className="rounded-2xl border p-6" style={{ borderColor: "#D8DED4", background: "#FFFFFF" }}>
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <p className="text-sm" style={{ color: "#8B9A8C" }}>
                Click any node to see the details for that subject, topic, or sub-topic.
              </p>
            </div>
          ) : (
            <div>
              {breadcrumb.length > 1 && (
                <p className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "#8B9A8C" }}>
                  {breadcrumb.slice(0, -1).join(" / ")}
                </p>
              )}
              <h3 className="font-display mt-1 text-xl font-semibold tracking-tight">{selected.name}</h3>

              {selected.mastery !== undefined ? (
                <>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "#EEF1EA" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${selected.mastery}%`, background: colorForMastery(selected.mastery) }}
                      />
                    </div>
                    <span className="font-mono text-xs" style={{ color: "#8B9A8C" }}>{selected.mastery}%</span>
                  </div>
                  <p className="mt-2 text-xs font-medium" style={{ color: colorForMastery(selected.mastery) }}>
                    {statusForMastery(selected.mastery)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs" style={{ color: "#8B9A8C" }}>Root of your tree</p>
              )}

              {selected.leafCount !== null && (
                <p className="mt-4 text-sm" style={{ color: "#3D4A40" }}>
                  Covers {selected.leafCount} sub-topic{selected.leafCount === 1 ? "" : "s"}.
                </p>
              )}

              {!selected.hasChildren && (
                <button
                  className="mt-6 w-full rounded-full py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: "#2F6B4F" }}
                >
                  Practice this topic
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
