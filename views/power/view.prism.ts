// Power tree — how power enters the design, becomes named rails, and
// reaches each load.
//
// The query asks the communication-level question ("what talks power to
// what") and never names mechanisms: regulators, filters, and switches are
// bridges the lowering follows, and every hop it took lands in the edge's
// evidence — click an edge and read the path in the inspector. Arrows render
// only where the compiler proved a direction; layout order is not evidence.
import { defineView, F, graph } from "@atopile/prism";
import { Diagram } from "@atopile/prism/ui";

// Trait-filtered so only real modules and interfaces appear as blocks, then
// enriched with each module's boundary ports — see the system view for why
// both steps matter.
const blocks = graph
  .root()
  .children()
  .filter({ traits: [F.is_module, F.is_interface] })
  .attrs("interfaces");

export default defineView({
  title: "Power tree",
  description: "How power enters the design, becomes named rails, and reaches each load.",
  target: "default",
  query: {
    blocks,
    // Same node pipeline, narrowed to power interfaces only: a focused
    // answer is a different (smaller) query, never a dimmed whole-design one.
    power: blocks.interfaceEdges({ kinds: ["power"] }),
  },
  render: ({ data }) => (
    <Diagram
      nodes={data.blocks}
      edges={data.power}
      direction="left-to-right"
      relationLabels
    />
  ),
});
