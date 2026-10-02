# Handoff: nRF9151 industrial multi-protocol node

**Project:** `nrf9151-modbus` (native KiCad 10)  
**Entry:** `nrf9151-modbus.kicad_pro` (root sheet `nrf9151-modbus.kicad_sch`)  
**Audience:** Parallel developer taking schematic/firmware/layout/fab without full chat history  
**Schematic status:** ERC 0; netlist verified.  
**PCB status:** 4-layer, 86 x 56 mm DIN-profile outline, all 144 parts placed on top, 49 test pads on the bottom, **unrouted**. Routing is done by the human board designer.  
**PCB checks:** `kicad-cli pcb drc --schematic-parity` gives 0 violations and 0 parity issues; only unrouted connections remain.

---

## 1. Product in one paragraph

Indoor **DIN-rail industrial** board (3D-printed DIN 43880 housing, 2 modules / 36 mm, TS35 rail, PCB vertical): **85-264 VAC** in -> isolated **5 V** brick -> **supercap hold-up** -> **nRF9151** LTE-M/NB-IoT + GNSS modem/MCU. Field side exposes **Modbus RTU master** (isolated RS-485) plus **RS-232** and **CAN** on a **single custom RJ45**. Cloud path is cellular. Debug is **J-Link SWD only** (10-pin header, plus SWD pads for the production tester). Parts target **JLCPCB / LCSC** assembly.

**Role:** Modbus RTU **master** on RS-485 -> application on nRF9151 -> cloud over cellular. Not a slave-only dongle; not a multi-port Ethernet switch.

---

## 2. Goals and non-goals

### Goals

| ID | Requirement |
|----|-------------|
| G1 | Mains-powered indoor panel, wide-range AC |
| G2 | Survive short AC drops via supercap hold-up (order of seconds; 3.5 F @ 5.5 V) |
| G3 | nRF9151 for LTE + GNSS + app MCU |
| G4 | Isolated RS-485 (Modbus), non-isolated RS-232 + CAN on one RJ45 |
| G5 | Brownout detect: reset + VSYS ADC for software |
| G6 | JLCPCB-friendly BOM, single-sided assembly (required by the automated tester) |
| G7 | Nordic-sane modem power (VDD bulk/FB, VDD_GPIO 3.3 V, RF ESD, SIM series/ESD) |
| G8 | Field ports survive accidental Ethernet/PoE plug-in on the shared RJ45 |
| G9 | Fits a 2-module DIN 43880 printed housing, testable on a bed-of-nails tester |

### Non-goals / out of scope (unless reopened)

- Ethernet / PoE  
- On-board LTE/GNSS PCB antennas (external IPEX only)  
- External 32.768 kHz crystal (none on SiP pins; internal LFXO)  
- SIM card-detect (holder CD pin left unconnected; `SIM_DET` tied present)
- eSIM / eUICC lock-in (product decision, see section 10)  
- AC MOV (optional site/panel; not on board)  
- Reset switch (reset via UVLO, SWD header and the nRESET test pad)  
- Agent-driven routing (human board designer routes; placement was done by the agent and is now owned by the board designer)  

---

## 3. Architecture summary

```
AC_L -- SMD fuse -- IRM-10-5 -- 5V_RAW
                                  |
                    +-------------+----------------------+
                    |             |                      |
                    |    Rsense + P-FET CC charger       |
                    |             |                      |
                    |         supercap 3.5F                |
                    |             |                      |
                    +- LM66100 <--+                      |
                    +- LM66100 <-- 5V_RAW                |
                              |                          |
                           VSYS (+ SMAJ5.0A)             |
                              |                          |
              +---------------+---------------+          |
              |               |               |          |
         LDO 3V3          FB+bulk          (loads)       |
              |               |                          |
         VDD_GPIO /      VDD_nRF (SiP VDD)               |
         logic / PHY     ~4-5 V from VSYS                |
```

**Schematic sheets (hierarchical, one sheet per block):**

| Sheet | Responsibility |
|-------|----------------|
| `nrf9151-modbus.kicad_sch` (root) | Sheet composition |
| `power.kicad_sch` | AC input terminal J1, fuse, IRM, CC supercap charge, ideal-diode OR, VSYS TVS, 3V3 LDO, UVLO, VSYS divider |
| `nrf9151.kicad_sch` | SiP, Nordic decoupling, RF/SIM/SWD, app I/O, TMP117 |
| `rs485.kicad_sch` ("Isolated RS-485") | ISOW1412 + termination + SM712 + local caps |
| `fieldbus.kicad_sch` ("Fieldbus RS-232 CAN RJ45") | MAX3232 + SMBJ15CA TVS, MCP2515 + crystal + SN65HVD230 + NUP2105LT1G, single RJ45 |

**Schematic style:** generated, one sheet per block; connections via net labels (local) and global labels for cross-sheet nets; power symbols for GND/+3V3.

---

## 4. Decisions log (why it is this way)

| Topic | Decision | Rationale / rejected alternatives |
|-------|----------|-----------------------------------|
| MCU/modem | **nRF9151-LACA-R** (`C42236596`) | Cellular + GNSS + app in one SiP |
| Mains PSU | **Mean Well IRM-10-5** (`C2857903`) | 10 W class isolated brick, indoor AC |
| AC protection | **SMD 2410 fuse** JDTfuse JFC2410-1100TS (`C136380`), 1 A time-lag, 250 V, 50 A breaking | Overcurrent; SMD so assembly stays single-sided; no AC MOV on board |
| AC input | **Phoenix MKDS 1,5 2-pos 5.08 mm** terminal block J1 (no LCSC number yet) | Added in KiCad design; no mains test pads on the board |
| Hold-up energy | **3.5 F / 5.5 V** CDA CHP5R5L355R-TW (`C2925904`), 150 mohm, 20 x 10 x 22 mm upright, 15.5 mm pitch | Short outage ride-through; 22 mm height fits the housing budget. Footprint drawn by hand (`jlc:CAP-TH_CDA_CHT-DA_2xD10_P15.5mm`, no EasyEDA model) |
| Cap charge limit | **Discrete CC**: 0.1 ohm + **INA180A1** + **MCP6001** + **AO4407A** (~**0.5 A**) | TPS259531 eFuse **rejected**: 2x2 mm die cannot sustain linear heat charging Farad-class C |
| OR-ing | **2x LM66100** (`C2869734`) | Low drop vs Schottky; reverse blocking |
| VSYS clamp | **SMAJ5.0A** (`C87074`) | Surge on DC rail |
| 3.3 V | **TLV1117-33** (`C91728`) | Peripherals + **VDD_GPIO** |
| Modem VDD | **From VSYS** via FB + bulk, **not** 3.3 V | Nordic VDD 3.0-5.5 V; RF/efficiency better >3.3 V; GPIO domain stays 3.3 V |
| RS-485 | **TI ISOW1412** (`C5216548`) | Integrated iso DC-DC; replaced VISOM TD301 approach |
| RS-485 isolation rule | **A/B isolated**; RJ45 GND is **board** GND for RS-232/CAN only | Do not tie ISOW bus-side GND to RJ45 pins 7-8 |
| RS-232 | **MAX3232IPWR** (`C113205`) | 3.3 V capable |
| CAN | **MCP2515-I/ST** TSSOP-20 SPI (`C15193`) + **SN65HVD230** (`C12084`) | nRF9151 has **no CAN MAC** |
| Field connector | **One** RJ45 `KH-RJ45-56-8P8C` (`C2683359`) | **Not** multiport C11193 |
| Field protection | **SM712** (`C12067`) on RS485 A/B to GND_ISO; **NUP2105LT1G** (`C14486`) on CAN H/L; 2x **SMBJ15CA** (`C78809`) on RS232 TX/RX | Survives accidental Ethernet/PoE plug-in on the shared RJ45 |
| Debug | 10-pin 1.27 mm SWD (J5), J-Link, plus 5 bottom SWD test pads (3V3, SWDIO, SWDCLK, nRESET, GND) | No USB-UART debug bridge; tester can flash the nRF9151 |
| Brownout | **APX803L-29** -> nRESET; divider -> **P0.04** ADC | Hardware reset + software monitoring of VSYS |
| LFXO | **Firmware LFXO** (internal SiP) | **No XL1/XL2 pins**; do not add external 32k crystal |
| SIM detect | Tied "present" | Holder CD pin left unconnected; product OK without switch |
| SIM holder | Push-push nano-SIM SHOU HAN NANO SIM 7P H1.37 (`C7529384`), 13.7 x 12.3 x 1.37 mm | Small, single-sided SMD; card inserted from the front |
| Reset | No reset switch | Reset via UVLO, SWD header and nRESET test pad |
| Housing / PCB | 3D-printed DIN 43880 housing, 2 modules, PCB vertical, no mounting holes | PCB is held by the printed housing |
| Assembly | Single-sided: all 144 parts on top; bottom has only 49 bare test pads | Required by the automated tester |
| RF ports | Dual IPEX + **PESD5V0F1BL**; **AUX 49.9 ohm** to GND | External antennas; unused AUX terminated |
| PCB ownership | **Agent placed, human routes** | Board designer owns routing and any placement changes |

### Schematic changes vs the original design

1. **SN65HVD230 VREF (pin 5) now unconnected.** It is an output (Vcc/2); the old design shorted it to GND.
2. **MCP2515 RX0BF / RX1BF / CLKOUT now unconnected.** They are outputs; the old design tied RXnBF to 3V3.
3. **Added AC mains input terminal block J1** (Phoenix MKDS 1,5 2-pos 5.08 mm, no LCSC number assigned yet).
4. **Fuse** is now an SMD 2410 part; **SIM holder** is a push-push nano-SIM; **supercap** is 3.5 F / 22 mm.
5. **CAN controller** MCP2515-I/ST (TSSOP-20); **crystal** YXC X32258MSB4SI 8 MHz 20 pF 3225 (`C2682774`) with 33 pF 0402 C0G load caps (`C1562`).
6. **Passives shrunk:** 1 uF -> 0402 (`C52923`), 4.7 uF -> 0402 (`C23733`), 10 uF -> 0603 (`C19702`), 22 uF -> 0603 6.3 V (`C59461`, 3V3 only), 120 ohm terminations -> 0402 (`C25079`), MAX3232 charge-pump caps 100 nF -> 0402 (`C1525`).
7. **Field protection added** (SM712, NUP2105LT1G, 2x SMBJ15CA).
8. **Removed:** reset switch and the two AC mains test pads.
MCU pin map, rails, RJ45 pinout and all other circuits are unchanged.

---

## 5. Electrical requirements (design targets)

### 5.1 Power

| Item | Target |
|------|--------|
| AC in | 85-264 VAC (IRM rating) |
| 5V_RAW | ~5 V from IRM, bulk 100 uF |
| Supercap charge | **I_set ~ 0.5 A** CC while V_cap rises |
| I_set formula | I ~ V_ref / (G_INA * R_sense), G = 20, R = 0.1 ohm, V_ref ~ 1.0 V |
| After charge | P-FET driven hard-on for top-up (plus sense R drop) |
| VSYS | OR of IRM and supercap via LM66100; SMAJ5 clamp |
| 3V3 | LDO from VSYS for logic/PHYs/VDD_GPIO |
| VDD_nRF | VSYS -> 1 uF x2 -> **BLM18KG300TN1D** -> 47 uF + 10 uF + 100 nF + 10 nF |
| VDD impedance goal | < ~0.2 ohm from 10-50 kHz at SiP during TX (Nordic) |
| UVLO | 2.9 V class on 3V3 -> nRESET |

**Thermal note (charger):** Peak FET dissipation ~ (5 - V_cap) x 0.5 A (up to 2.5 W at start; 3.5 F charges in ~35 s). Pour copper under **AO4407A**; verify loop stability (gate 1 k + 10 nF). See section 10 for the recommended I_set reduction.

**Hold-up:** usable energy for the 3V3 domain (VSYS 5.0 -> 4.4 V) is ~10 J.

### 5.2 Field buses (RJ45 custom)

| Pin | Signal | Domain |
|-----|--------|--------|
| 1 | RS485_A | **Isolated** |
| 2 | RS485_B | **Isolated** |
| 3 | RS232_TX | Board 3V3 / GND |
| 4 | CAN_H | Board 3V3 / GND |
| 5 | CAN_L | Board 3V3 / GND |
| 6 | RS232_RX | Board 3V3 / GND |
| 7 | GND | Board GND |
| 8 | GND | Board GND |
| 9-10 | Shield | Board GND |

RS-485: half-duplex, **DE** tied with **/RE** behavior on ISOW (see `rs485.kicad_sch`). 120 ohm (0402) termination on iso bus. The RJ45 pinout is also printed on the back silkscreen.

### 5.3 MCU pin map (locked in schematic)

| Function | nRF9151 | Notes |
|----------|---------|--------|
| RS-485 UART TX | P0.10 | |
| RS-485 UART RX | P0.11 | |
| RS-485 DE | P0.12 | /RE tied in PHY wiring |
| RS-232 TX | P0.13 | |
| RS-232 RX | P0.14 | |
| CAN SPI SCK | P0.15 | |
| CAN SPI MOSI | P0.16 | |
| CAN SPI MISO | P0.17 | |
| CAN SPI nCS | P0.18 | |
| CAN nINT | P0.19 | |
| I2C SDA | P0.02 | TMP117, 4.7 k pull-ups |
| I2C SCL | P0.03 | 400 kHz intent |
| VSYS ADC | P0.04 | Resistor divider from VSYS |
| SWD | SWDIO / SWDCLK | 10 k up on SWDIO; **100 k down** on SWDCLK |
| nRESET | nRESET | 10 k up + 100 nF; UVLO + SWD + test pad (no button) |

### 5.4 RF / SIM / clock (firmware-relevant)

| Item | Hardware | Firmware / test |
|------|----------|-----------------|
| LTE ANT | IPEX J2 + PESD | 50 ohm layout |
| GNSS GPS | IPEX J3 + PESD | Keep noise off this path |
| AUX | 49.9 ohm to GND | Optional coexistence dump |
| SIM | 22 ohm series CLK/IO/RST; USBLC6-2 + PESD; 100 nF + 1 uF on 1V8 | Physical SIM or SoftSIM, see section 6 |
| LFXO | Internal | **Select LFXO**, not LFRC, for PSM/eDRX timing |
| HFXO | Internal to SiP | |

### 5.5 Environment / compliance (intent, not certified)

- Indoor industrial panel  
- Mains creepage/clearance on AC side (enforced by DRC rules, see section 8)  
- RS-485 isolation barrier across ISOW1412 (keep-out under chip centre)  
- Surge: fuse + IRM + VSYS TVS; **no on-board AC MOV**  
- Field ports: SM712 / NUP2105LT1G / SMBJ15CA TVS for accidental Ethernet/PoE plug-in  
- EMC: VDD ferrite + bulk; RF ESD; full EMC campaign not done in-repo

---

## 6. Key BOM identities (LCSC)

Use these exact IDs; do not invent MPNs. Every symbol in the project library carries an `LCSC` field; passives use KiCad stock `Device:R` / `Device:C` with an `LCSC` field (JLC basic parts where possible).

| Function | LCSC | MPN / notes |
|----------|------|-------------|
| AC-DC | C2857903 | IRM-10-5 |
| AC terminal J1 | none yet | Phoenix MKDS 1,5 2-pos 5.08 mm |
| Fuse | C136380 | JDTfuse JFC2410-1100TS, SMD 2410, 1 A T, 250 V, 50 A breaking |
| Supercap | C2925904 | CDA CHP5R5L355R-TW, 3.5 F 5.5 V, 150 mohm, 20x10x22 mm upright |
| P-FET charger | C16072 | AO4407A |
| CSA | C122228 | INA180A1IDBVR |
| Op-amp | C21403 | MCP6001UT-I/OT |
| Ideal diode | C2869734 | LM66100DCKR x2 |
| VSYS TVS | C87074 | SMAJ5.0A-13-F |
| LDO 3.3 | C91728 | TLV1117-33 |
| UVLO | C2066862 | APX803L-29 |
| nRF9151 | C42236596 | NRF9151-LACA-R |
| VDD FB | C88982 | BLM18KG300TN1D |
| IPEX | C437254 | ECT818000500 x2 |
| SIM holder | C7529384 | SHOU HAN NANO SIM 7P H1.37 push-push, 13.7 x 12.3 x 1.37 mm; CD pin NC |
| RF ESD | C45961 | PESD5V0F1BL x several |
| SIM ESD array | C7519 | USBLC6-2SC6 |
| ISOW1412 | C5216548 | RS-485 + iso DCDC |
| MAX3232 | C113205 | |
| MCP2515 | C15193 | MCP2515-I/ST TSSOP-20 |
| SN65HVD230 | C12084 | |
| RJ45 | C2683359 | KH-RJ45-56-8P8C |
| TMP117 | C699536 | |
| SWD header | C9900011230 | FTSH-105 style |
| Crystal (8 MHz) | C2682774 | YXC X32258MSB4SI, 20 pF, 3225, CAN oscillator Y1; 33 pF C0G 0402 load caps (C1562) |
| RS-485 TVS | C12067 | SM712 |
| CAN TVS | C14486 | NUP2105LT1G |
| RS-232 TVS | C78809 | SMBJ15CA x2 (D9/D10) |
| 1 uF / 4.7 uF | C52923 / C23733 | 0402 |
| 10 uF / 22 uF | C19702 / C59461 | 0603 (22 uF 6.3 V, 3V3 only) |
| 120 ohm | C25079 | 0402 termination |
| 100 nF (MAX3232) | C1525 | 0402 |

---

## 7. Repo layout and toolchain

```
nrf9151-modbus/
  nrf9151-modbus.kicad_pro      # project
  nrf9151-modbus.kicad_sch      # root sheet
  power.kicad_sch               # sub-sheet: mains, charger, hold-up, rails
  nrf9151.kicad_sch             # sub-sheet: SiP, RF, SIM, SWD, temp
  rs485.kicad_sch               # sub-sheet: Isolated RS-485
  fieldbus.kicad_sch            # sub-sheet: Fieldbus RS-232 CAN RJ45
  nrf9151-modbus.kicad_pcb      # 4-layer, 86 x 56 mm DIN outline, placed, unrouted
  nrf9151-modbus.kicad_dru      # custom DRC rules
  sym-lib-table, fp-lib-table   # register the `jlc` library
  lib/jlc.kicad_sym             # project-local symbols (LCSC parts)
  lib/jlc.pretty/               # footprints
  lib/jlc.3dshapes/             # 3D models (tracked via Git LFS, see .gitattributes)
  README.md                     # Short architecture
  HANDOFF.md                    # This document
```

**Project-local part library.** Generated from LCSC with:

```bash
uvx easyeda2kicad --full --lcsc_id=Cxxxx --output lib/jlc
```

Fallback for parts EasyEDA rate-limits (RJ45 C2683359): `uvx JLC2KiCadLib Cxxxx`. 3D model paths use `${KIPRJMOD}/lib/jlc.3dshapes`. 3D models are stored with Git LFS.

**Custom DRC rules (`nrf9151-modbus.kicad_dru`):**

- JLC 4-layer minimums: 0.1 mm track/space, 0.2 mm via drill, 0.1 mm annular ring, 0.3 mm copper-to-edge.
- **6 mm** clearance from AC nets (`/Power/AC_*`) to everything else.
- **2.5 mm** between L and N.
- **4 mm** across the RS-485 isolation barrier (GND_ISO, VISO, RS485_A/B versus the rest of the board; RJ45 J6 is exempt).

**Checks:**

```bash
kicad-cli pcb drc --schematic-parity nrf9151-modbus.kicad_pcb
```

Currently 0 violations and 0 parity issues; only unrouted connections remain.

**Fab flow.** Install **Bouni/kicad-jlcpcb-tools** via the KiCad Plugin and Content Manager for BOM/CPL (reads the `LCSC` field; check rotations in the JLC preview), or use **bennymeg Fabrication-Toolkit >= 5.3.1**. JLCPCB stackup **JLC04161H-7628** (1.6 mm, 4 layer); use the JLC impedance calculator for the 50 ohm ANT/GPS microstrips.

---

## 8. Layout / PCB state and requirements (for the board owner)

### Mechanical envelope

- **Housing:** 3D-printed DIN-rail housing, DIN 43880 profile, 2 modules (36 mm wide), TS35 rail. The PCB stands vertical, parallel to the side walls.
- **Outline:** DIN profile with centred nose: body 86 x 44 mm + nose 41 x 12 mm (nose spans x 22.5..63.5 and sits in the 45 mm cover window). Overall 86 x 56 mm, 4 layers (JLC04161H-7628).
- **Height budget:** ~29 mm above the PCB (36 mm housing, ~1.5 mm walls, PCB ~2 mm from wall). Tallest parts: supercap 22 mm, IRM-10-5 21.7 mm, RJ45 13.2 mm. The housing must leave >= 22 mm (+margin) above the PCB.
- **Mounting:** no mounting holes; the PCB is held by the printed housing.
- **Single-sided assembly** (required by the automated tester): all 144 parts on top. The bottom carries only 49 bare 1.5 mm test pads (min 2.54 mm pitch) for the bed-of-nails tester, including a 5-pad SWD row (3V3, SWDIO, SWDCLK, nRESET, GND) so the tester can flash the nRF9151. No mains nets on test pads. SWD header J5 is kept as well.

### Current floorplan (placed by agent, unrouted)

Coordinates: x along the 86 mm module height, y = depth, y = 0 at the nose front, rail at the back.

- **Mains, right side:** AC terminal J1 at the right edge -> SMD fuse F1 -> IRM-10-5 PS1 along the back-right, AC end on the right.
- **Left edge (opposite the 230 VAC):** RJ45 J6, opening out of the module's end face so the field cable plugs in behind the cabinet cover, invisible from the front. MAX3232 U10 and SN65HVD230 U12 sit just behind it next to its RS-232/CAN pins.
- **Isolation:** ISOW1412 U9 directly right of the RJ45, rotated 180 deg so its isolated bus side faces the jack, with an iso pocket in between holding the SM712, 120 ohm termination and VISO caps. The isolation gap runs vertically under the ISOW centre.
- **Back-left:** upright supercap C2 and the CC charger (R1 / Q1 / U1 / U2); SWD header J5 between charger and ISOW; ideal diodes U3/U4 next to the IRM DC end.
- **Nose:** LDO U5 (left) and nano-SIM J4 (right, card inserted from the front).
- **Middle:** MCP2515 U11 + crystal Y1 between the ISOW and the nRF.
- **nRF9151 U7** centre-right with IPEX J2 (LTE) and J3 (GNSS) on its right flank, >= 6 mm from mains copper.
- **Rule areas:** `MAINS_CREEPAGE` (right front corner), `RS485_ISOLATION_GAP` (vertical strip under the ISOW centre), `ANTENNA_IPEX`. DRC custom rules unchanged (6 mm mains, 4 mm iso barrier, JLC minimums).
- **Silkscreen:** LTE / GNSS at the IPEX connectors, AC IN, DANGER 230VAC; back side: RJ45 pinout and title.

### Layout debts

1. **AC:** fuse, IRM, creepage, terminal mechanics (J1 screw access, see section 10)  
2. **Charger:** Kelvin-ish **0.1 ohm**; copper under **AO4407A**; short gate loop  
3. **Isolation:** ISOW barrier; RS-485 A/B only on iso side; no accidental plane bridge  
4. **RF:** 50 ohm ANT/GPS microstrips; IPEX keep-outs; GND under SiP; NWP-056 NSMD/stencil  
5. **GNSS:** away from ISOW switcher / digital edges  
6. **Modem power:** FB + 47 uF cluster **at** SiP VDD  
7. **RJ45 / shield** mechanics at the left module end face (housing cutout there); keep field TVS traces short  
8. **SWD** header and bottom test pads accessible  

---

## 9. Firmware / bring-up checklist

1. Clocks: enable **LFXO** (not LFRC) for modem timing.  
2. Pin mux per table in section 5.3.  
3. RS-485: DE on P0.12; half-duplex direction control; Modbus master stack.  
4. RS-232: second UART P0.13/14.  
5. CAN: MCP2515 SPI + interrupt; transceiver silent/normal as needed.  
6. VSYS ADC on P0.04: calibrate divider; graceful shutdown on hold-up.  
7. nRESET / APX803: confirm reset release timing with 100 nF.  
8. SIM: 1.8 V UICC; series R in path; physical SIM vs SoftSIM selection per section 10.  
9. RF: antenna presence; modem certification hooks as required by product SKU.  
10. TMP117 @ I2C 0x48 (ADD0 hard tied GND in design).

**Hold-up behavior:** On AC loss, supercap -> LM66100 -> VSYS feeds modem VDD and 3V3 LDO until UVLO. Charge path does not limit **discharge**.

---

## 10. SIM / connectivity strategy and open items

### SIM / connectivity strategy

- **No eSIM/eUICC lock-in** (product decision). Keep the 4FF holder for a physical SIM (e.g. Wireless Logic / Conexa) and add **Onomondo SoftSIM** in firmware (github.com/onomondo/nrf-softsim, ~110 KB flash, ~30 KB heap, profile stored in app flash via NVS + TF-M PSA crypto).
- The nRF9151 has **one UICC interface**; firmware selects physical SIM vs SoftSIM with `AT%CSUS` (`AT+CFUN=0` first). Verify exact values in the nRF91x1 AT command reference.
- Failover logic is ours; only one identity is active at a time; switching costs a reattach.
- SoftSIM is Onomondo-proprietary (not a GSMA eSIM profile). OTA replacement of the SoftSIM profile is not documented, so we need our own delivery path (e.g. via FOTA).
- **Rejected for now:** SGP.32 MFF2 eUICC (provider/eIM lock-in risk).

### Open items

| Item | Status |
|------|--------|
| PCB routing | **Human** board designer; board is placed but unrouted |
| Charger thermal | 3.5 F at 0.5 A CC charges in ~35 s; AO4407A dissipates up to 2.5 W at start. Recommend lowering I_set to ~0.23 A (R_vref_hi 40.2k -> 100k) or a DPAK FET. Not changed yet - decide |
| Charger loop | Supercap / charger loop stability and I_set still need bench verification |
| Housing: RJ45 cutout | RJ45 J6 opens out of the left module end face (opposite J1); the printed housing needs the jack cutout there, snug around the shield so plug forces go into the housing |
| Housing: J1 access | J1 is a horizontal Phoenix-style terminal block whose screws face perpendicular to the PCB, i.e. toward a side wall in a vertical-PCB DIN housing. The printed housing needs screw access openings, or J1 must change to a front-screw / pluggable type |
| Housing: height | Housing must leave >= 22 mm (+margin) above the PCB; supercap / IRM are 22 / 21.7 mm |
| J1 terminal block | Still has no LCSC number |
| RJ45 isolation | Single shared RJ45 puts isolated RS485_A/B ~1 mm from RS-232/CAN pins inside the jack. The RS-485 isolation is functional (ground-loop breaking), **not** reinforced safety isolation, regardless of the ISOW1412 rating |
| Hold-up headroom | TLV1117-33 dropout ~1.1 V means 3V3 sags once VSYS < ~4.4 V, so only ~5.0 -> 4.4 V of the supercap swing is usable for the 3V3 domain (~10 J of 3.5 F). Consider a low-dropout LDO or buck-boost if longer hold-up is needed |
| SIM C6 / VPP | Tied to SIM_1V8 (kept from old design; Nordic reference leaves it NC). Review |
| Supercap CV | Charges toward ~5V_RAW; SMAJ is a clamp, not a precision CV; 5.5 V cap rating OK with 5 V rail |
| Silkscreen | Reference designators need tidying after routing |
| AC MOV | Not fitted; add at panel if required |
| SIM mechanical detect | Not required (product decision) |
| EMC / safety cert | Not executed in-repo |

---

## 11. How to work in parallel

| Role | Owns | Do not |
|------|------|--------|
| Schematic | `*.kicad_sch`, `lib/jlc.*`, `LCSC` fields | Silently change RJ45 pinout or MCU pins without firmware sync |
| PCB / board owner | `nrf9151-modbus.kicad_pcb`, routing, creepage, RF, placement | Rewrite power topology in copper only |
| Firmware | Pin map section 5.3, LFXO, Modbus, CAN SPI | Assume external 32k xtal |
| Fab / PM | BOM, CPL, gerbers, fuse cartridge rating | Swap iso RS-485 GND onto RJ45 7-8 |

**Rules:**

- The schematic is the source of truth. After schematic edits, use **Update PCB from Schematic (F8)** in the PCB editor.
- Never move placement without asking the board owner; the board owner now routes.
- Run **ERC** and **DRC** (including schematic parity) before fab.

**Change control:** Any pin, RJ45, or rail change -> update this file + README + firmware pin header in one motion.

---

## 12. Quick start for a new developer

1. Open `nrf9151-modbus.kicad_pro` in **KiCad 10** (fetch Git LFS objects for the 3D models first).  
2. Read **this file**, then `README.md`, then skim the sub-sheets listed in section 3.  
3. Run ERC in the schematic editor and `kicad-cli pcb drc --schematic-parity` on the PCB; confirm the state in the header above.  
4. Layout: open `nrf9151-modbus.kicad_pcb`; the custom rules in `nrf9151-modbus.kicad_dru` apply automatically.  
5. Fab: generate BOM/CPL with the JLCPCB plugin (section 7).  
6. Firmware: lock pins from section 5.3; bring up power rails before RF.  

**Primary source of truth for circuits:** the KiCad schematic  
**Primary source of truth for product decisions:** `HANDOFF.md` (this file)

---

*End of handoff.*
