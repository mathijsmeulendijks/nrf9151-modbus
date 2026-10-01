// Bill of materials — every part the design puts on the board, folded into
// order lines. `is_atomic_part` is definitionally what lands on a BOM — the
// same population every other BOM output uses.
//
// Three ideas worth copying from this view:
//   - `implementors` is an indexed entry point: it selects every owner of a
//     trait with no traversal, so it scales past what walking the tree can.
//   - `attrs("parts")` attaches the part attribute bundle (mpn,
//     manufacturer, package, pricing, …) carried by `is_atomic_part`, and
//     implies picker demand — the query says what it needs and the engine
//     acquires it. The pack string is visible sugar for
//     `attrs({ trait: "is_atomic_part" })`.
//   - `groupBy` folds identical parts into one row per distinct key tuple,
//     adds a `quantity` cell, and keeps every contributing component's
//     stable path — so selecting a row highlights its parts everywhere.
//
// Every cell is a display + hidden min/max interval (a scalar is the
// degenerate min == max): the table renders the worker's own formatting
// verbatim and sorts on the center of the interval, which is why "9 mΩ"
// orders before "10 mΩ" without the client ever parsing a unit.
import { defineView, graph } from "@atopile/prism";
import { DataTable } from "@atopile/prism/ui";

const lines = graph
  .implementors("is_atomic_part")
  .attrs("parts")
  .groupBy("mpn", "manufacturer", "package");

const byQuantity = { column: "quantity", direction: "descending" } as const;

export default defineView({
  title: "Bill of materials",
  description: "Order lines: grouped parts with quantities, packages, and supplier references.",
  target: "default",
  query: { lines },
  render: ({ data }) => (
    <DataTable
      rows={data.lines}
      title="Order lines"
      columns={["mpn", "manufacturer", "package", "quantity"]}
      initialSort={byQuantity}
    />
  ),
});
