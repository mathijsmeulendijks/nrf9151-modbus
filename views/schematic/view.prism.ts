// Schematic — a component-level schematic of the design's atomic parts,
// with reviewed Prism/manufacturer symbols and net-level connectivity.
//
// Four ideas worth copying from this view:
//   - One trait, not a type list: `is_atomic_part` selects every placeable
//     component — resistor, opamp, connector, whatever the design grows —
//     so the view never needs a hand-maintained palette of types.
//   - `attrs("leads")` attaches ports and optional manufacturer-symbol
//     assets. Schematic uses Prism symbols for standard-library types and
//     manufacturer symbols for everything else by default.
//   - `attrs("interfaces")` does the same job for the interfaces crossing
//     the scope's boundary, and Schematic draws them as boundary ports:
//     rail bars, earths, off-sheet flags, and bus ports labelled with the
//     nets they carry. They are ordinary graph nodes, so `buses()` wires
//     them to the circuit — no synthetic endpoints, no hand-written globs.
//   - `nets: symbols.buses()` reuses the same node pipeline for strict
//     net-level connectivity between exactly those nodes.
//
// This scaffold draws the whole design; a real schematic view earns its
// keep by narrowing — scope to one stage (`graph.at("amp_stage")` as the
// root of both pipelines below) or to one family
// (`graph.instances("OpAmp")`) so the picture answers one question. Saved
// positions and every other human display choice live in the machine-owned
// layout.json beside this file. Base Prism components load and save it
// automatically; authored views only declare design data and presentation.
import { defineView, F, graph } from "@atopile/prism";
import { Schematic } from "@atopile/prism/ui";

const scope = graph.root();

const components = scope
  .children({ depth: 4, requiredTrait: F.is_atomic_part })
  .attrs("leads")
  .parameters();

// The scope's public face. Selecting a supply whole (`power`) draws one
// two-row bus port; selecting its sides (`power.hv`, `power.lv`) draws the
// conventional rail bar and earth instead — the query decides.
const face = scope
  .children({ depth: 1 })
  .filter({ traits: [F.is_interface] })
  .attrs("interfaces");

const symbols = components.union(face);

export default defineView({
  title: "Schematic",
  description: "A component-level schematic. Narrow the component query to the stage you want to explain.",
  target: "default",
  query: { symbols, nets: symbols.buses() },
  render: ({ data }) => (
    <Schematic
      nodes={data.symbols}
      nets={data.nets}
      direction="left-to-right"
      compactArrays
      maxSymbols={24}
    />
  ),
});
