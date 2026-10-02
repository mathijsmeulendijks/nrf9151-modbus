# nRF9151 multi-protocol industrial node

DIN-rail board (3D-printed 2-module housing, TS35): **85-264 VAC** (Mean Well IRM-10-5) -> **discrete CC supercap charger** hold-up (0.1 ohm + INA180A1 + MCP6001 + AO4407A) -> **nRF9151** cellular/GNSS with **RS-485 + RS-232 + CAN** on one RJ45.

Native **KiCad 10** project. Schematic is the source of truth for circuits; the PCB is fully placed but **unrouted** (routing is done by the board designer). The PCB stands vertical in a DIN 43880 housing (2 modules, 36 mm wide).

## Architecture

| Block | Implementation |
|-------|----------------|
| Mains in | Phoenix MKDS 1,5 2-pos 5.08 mm terminal J1 (no LCSC number yet) |
| Mains fuse | **SMD 2410 fuse** JFC2410-1100TS (1 A time-lag, 250 V, C136380) -> IRM-10-5 (C2857903) |
| Supercap charge | **Discrete CC**: 0.1 ohm sense + **INA180A1** + **MCP6001** + **AO4407A** P-FET (~0.5 A) |
| Hold-up | **3.5 F / 5.5 V** CDA CHP5R5L355R-TW (C2925904, 20x10x22 mm upright) + **dual LM66100** ideal-diode OR into VSYS |
| Surge | **SMAJ5.0A** on VSYS |
| Brownout | APX803L-29 (2.9 V UVLO -> nRESET) + VSYS ADC on P0.04 |
| 3.3 V | TLV1117-33 (peripherals + **VDD_GPIO**) |
| Modem VDD | **VSYS (~4-5 V)** through FB + bulk (not 3.3 V) |
| MCU/modem | NRF9151-LACA-R |
| RF | LTE + GNSS IPEX + **PESD5V0F1BL** RF ESD; AUX 49.9 ohm |
| SIM | Push-push nano-SIM (C7529384), **22 ohm** series, **USBLC6-2** + PESD ESD; physical SIM plus optional Onomondo SoftSIM in firmware (no eSIM lock-in) |
| RS-485 | **TI ISOW1412** isolated transceiver + iso DC-DC; **SM712** TVS |
| RS-232 | **TI MAX3232IPWR**; 2x **SMBJ15CA** TVS |
| CAN | MCP2515-I/ST TSSOP-20 (SPI, C15193) + **TI SN65HVD230** + 8 MHz crystal (C2682774); **NUP2105LT1G** on CAN H/L |
| Field I/O | Single RJ45 (KH-RJ45-56-8P8C) |
| Debug | 10-pin SWD; SWDIO 10 k up, **SWDCLK 100 k down**; no reset switch (reset via UVLO, SWD, nRESET test pad) |
| Temp | TMP117 on I2C |

## Power path

```
AC_L -> SMD fuse -> IRM-10-5 -> 5V_RAW
                         |- Rsense + P-FET CC -> supercap -+
                         '- LM66100 -----------------------+-> VSYS -+-> LDO 3V3 -> VDD_GPIO / logic
                                                           |         '-> FB -> VDD_nRF (SiP VDD)
                         supercap -> LM66100 --------------+
VSYS <- SMAJ5.0A clamp
```

**Why VDD from VSYS:** Nordic VDD is 3.0-5.5 V; RF headroom and TX efficiency are better above 3.3 V. VDD_GPIO stays at 3.3 V for ISOW / MAX3232 / CAN / SWD levels.

**Ideal diodes:** LM66100 (~95 mohm) replace a Schottky OR so hold-up loses less voltage under load.

## Supercap charge limiter (FET + op-amp)

| Piece | Role |
|-------|------|
| **0.1 ohm** 1206 sense | V_sense = I * R (50 mV @ 0.5 A) |
| **INA180A1** (20 V/V) | High-side sense -> V_fb ~ 1.0 V @ 0.5 A |
| Divider 40.2k/10k | V_ref ~ 1.0 V from 5 V |
| **MCP6001** | Error amp: V_fb > V_ref raises P-FET gate (less current) |
| **AO4407A** SOP-8 | P-FET handles linear heat; ~fully on when I < I_set for top-up |

```
I_set ~ V_ref / (G_INA * R_sense) ~ 1.0 / (20 * 0.1) = 0.5 A
```

Pour copper under AO4407A; keep sense Kelvin-ish. SMAJ5.0A clamps VSYS (not a precision CV for the 5.5 V cap, which charges to ~5V_RAW).

## Field RJ45 pinout (custom multi-bus)

| Pin | Signal |
|-----|--------|
| 1-2 | RS485_A / B (isolated; **not** board GND) |
| 3 / 6 | RS232_TX / RX |
| 4-5 | CAN_H / L |
| 7-8 | GND (RS-232 / CAN reference) |
| 9-10 | Shield -> board GND |

## MCU pin map

| Function | Pins |
|----------|------|
| RS-485 UART | P0.10 TX, P0.11 RX, P0.12 DE (/RE) |
| RS-232 UART | P0.13 TX, P0.14 RX |
| CAN SPI | P0.15 SCK, P0.16 MOSI, P0.17 MISO, P0.18 nCS, P0.19 nINT |
| I2C temp | P0.02 SDA, P0.03 SCL |
| VSYS ADC | P0.04 |

## Project files

| File | Content |
|------|---------|
| `nrf9151-modbus.kicad_pro` / `.kicad_sch` | Project and root sheet |
| `power.kicad_sch` | Mains, charger, hold-up, VSYS, 3V3, UVLO |
| `nrf9151.kicad_sch` | SiP, decoupling, RF, SIM, SWD, temp |
| `rs485.kicad_sch` | Isolated RS-485 |
| `fieldbus.kicad_sch` | Fieldbus RS-232, CAN, RJ45 |
| `nrf9151-modbus.kicad_pcb` | 4-layer, 86 x 56 mm DIN outline (body 86 x 44 + nose 41 x 12), all 144 parts on top, 49 bare test pads on the bottom, unrouted |
| `nrf9151-modbus.kicad_dru` | Custom DRC rules (JLC minimums, mains and isolation clearances) |
| `lib/jlc.kicad_sym`, `lib/jlc.pretty`, `lib/jlc.3dshapes` | Project-local LCSC part library (3D models via Git LFS) |

Board is single-sided assembly: the bottom carries only test pads for the bed-of-nails tester (incl. a 5-pad SWD row), no mains nets. See `HANDOFF.md` for decisions, SIM strategy, open items and bring-up checklist.

## Open and fabricate

1. Open `nrf9151-modbus.kicad_pro` in **KiCad 10**.
2. Run ERC and DRC (`kicad-cli pcb drc --schematic-parity`) before fab.
3. BOM/CPL: install **Bouni/kicad-jlcpcb-tools** via the Plugin and Content Manager (reads the `LCSC` field; check rotations in the JLC preview), or **bennymeg Fabrication-Toolkit >= 5.3.1**.
4. Order with JLCPCB stackup **JLC04161H-7628** (1.6 mm, 4 layer); use the JLC impedance calculator for the 50 ohm ANT/GPS microstrips.
