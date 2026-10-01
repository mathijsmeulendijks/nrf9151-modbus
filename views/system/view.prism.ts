// System overview — the smallest complete picture of the design: every
// top-level module and the interfaces connecting them.
//
// A Prism view is a typed TS module that owns both halves of the answer:
//   query  — named dataset pipelines, run against the live compiler graph
//   render — real JSX composing @atopile/prism/ui against those datasets
//
// The dataset kinds flow from the query: `data.blocks` is a node dataset
// because the `blocks` pipeline yields nodes, and `data.flow` is an edge
// dataset because `interfaceEdges` yields relations.
import { defineView, F, graph } from "@atopile/prism";
import { DefaultView } from "@atopile/prism/ui";

// Pipelines are immutable values — build once, reuse across datasets.
// On a real design, root().children() also returns constraint/parameter
// machinery nodes, not just design blocks. The trait filter is the standard
// idiom for keeping only the actual modules and interfaces — semantic
// predicates like this keep the view true as the design grows, where a name
// glob would silently rot.
//
// attrs("interfaces") attaches each module's public boundary as ports —
// one per direct interface-typed child, connected or not. Diagram draws
// port rows only from node.ports (it never infers them from edge
// endpoints), so without this enrichment the blocks render as port-less
// cards even though the edges name ports.
const blocks = graph
  .root()
  .children()
  .filter({ traits: [F.is_module, F.is_interface] })
  .attrs("interfaces");

export default defineView({
  title: "System overview",
  description: "The top-level modules and interfaces that make up this design.",
  target: "default",
  query: {
    blocks,
    // Communication-level edges between the selected blocks. Bridges are
    // followed by default; each hop lands in the edge's evidence, so the
    // mechanism shows up in the inspector, never in the query.
    flow: blocks.interfaceEdges(),
  },
  // <DefaultView> is the library's default composition:
  // Node+Edge datasets merge onto one <Diagram> canvas, Row datasets become
  // <DataTable>s. It is an ordinary component, not shell magic — swap it for
  // bespoke JSX when this view outgrows the default (the power view
  // composes <Diagram> directly).
  render: ({ data }) => <DefaultView datasets={data} />,
});
