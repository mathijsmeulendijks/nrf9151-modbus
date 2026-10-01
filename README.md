# nRF9151 multi-protocol industrial node

Indoor panel board: **85–264 VAC** (Mean Well IRM-10-5) → **TI eFuse** supercap hold-up → **nRF9151** cellular/GNSS with **RS-485 + RS-232 + CAN** on one RJ45.

## Architecture

| Block | Implementation |
|-------|----------------|
| Mains | **5×20 fuse holder** (C3131, fit ~1 A T) → IRM-10-5 (C2857903) |
| Supercap charge | **Discrete CC**: 0.1 Ω sense + **INA180A1** + **MCP6001** + **AO4407A** P-FET (~0.5 A) |
| Hold-up | 0.47 F / 5.5 V + **dual LM66100** ideal-diode OR into VSYS |
| Surge | **SMAJ5.0A** on VSYS |
| Brownout | APX803L-29 (2.9 V UVLO → nRESET) + VSYS ADC on P0.04 |
| 3.3 V | TLV1117-33 (peripherals + **VDD_GPIO**) |
| Modem VDD | **VSYS (~4–5 V)** through FB + bulk (not 3.3 V) |
| MCU/modem | NRF9151-LACA-R |
| RF | LTE + GNSS IPEX + **PESD5V0F1BL** RF ESD; AUX 49.9 Ω |
| SIM | Nano-SIM, **22 Ω** series, **USBLC6-2** + PESD ESD |
| RS-485 | **TI ISOW1412** reinforced isolation + iso DC-DC |
| RS-232 | **TI MAX3232IPWR** |
| CAN | MCP2515T-I/SO (SPI) + **TI SN65HVD230** + 8 MHz crystal |
| Field I/O | Single RJ45 (KH-RJ45-56-8P8C) |
| Debug | 10-pin SWD; SWDIO 10 kΩ up, **SWDCLK 100 kΩ down** |
| Temp | TMP117 on I2C |

## Power path

```
AC_L → fuse → IRM-10-5 → 5V_RAW
                         ├─ Rsense + P-FET CC → supercap ─┐
                         └─ LM66100 ───────────────────────┼→ VSYS ─┬→ LDO 3V3 → VDD_GPIO / logic
                                                           │        └→ FB → VDD_nRF (SiP VDD)
                         supercap → LM66100 ───────────────┘
VSYS ← SMAJ5.0A clamp
```

**Why VDD from VSYS:** Nordic VDD is 3.0-5.5 V; RF headroom and TX efficiency are better above 3.3 V. VDD_GPIO stays at 3.3 V for ISOW / MAX3232 / CAN / SWD levels.

**Ideal diodes:** LM66100 (~95 mΩ) replace Schottky OR so hold-up loses less voltage under load.

## Supercap charge limiter (FET + op-amp)

Replaces TPS259531 eFuse (too small thermally for long CC into 0.47 F).

| Piece | Role |
|-------|------|
| **0.1 Ω** 1206 sense | \(V_{\mathrm{sense}} = I\cdot R\) (50 mV @ 0.5 A) |
| **INA180A1** (20 V/V) | High-side sense → \(V_{\mathrm{fb}} \approx 1.0\,\mathrm{V}\) @ 0.5 A |
| Divider 40.2k/10k | \(V_{\mathrm{ref}} \approx 1.0\,\mathrm{V}\) from 5 V |
| **MCP6001** | Error amp: \(V_{\mathrm{fb}} > V_{\mathrm{ref}}\) raises P-FET gate (less current) |
| **AO4407A** SOP-8 | P-FET handles linear heat; ~fully on when \(I < I_{\mathrm{set}}\) for top-up |

\[
I_{\mathrm{set}} \approx \frac{V_{\mathrm{ref}}}{G_{\mathrm{INA}}\cdot R_{\mathrm{sense}}}
\approx \frac{1.0}{20\cdot 0.1} = 0.5\,\mathrm{A}
\]

Layout: pour copper under AO4407A; keep sense Kelvin-ish. Tune \(R_{\mathrm{vref}}\) / \(R_{\mathrm{sense}}\) if you want a different limit. SMAJ5.0A still clamps VSYS (not a precision CV for the 5.5 V cap - charged to ~5 V_RAW).

## Field RJ45 pinout (custom multi-bus)

| Pin | Signal |
|-----|--------|
| 1–2 | RS485_A / B (isolated; **not** board GND) |
| 3 / 6 | RS232_TX / RX |
| 4–5 | CAN_H / L |
| 7–8 | GND (RS-232 / CAN reference) |
| 9–10 | Shield → board GND |

## nRF9151 decoupling / RF / SIM

| Net | Network |
|-----|---------|
| VSYS → FB | 1 µF + 1 µF source side |
| FB | Murata BLM18KG300TN1D |
| **VDD_nRF** | **47 µF + 10 µF + 100 nF + 10 nF** (10 V rated) |
| VDD_GPIO | 10 µF + 100 nF on 3V3 |
| DEC0 | 4.7 µF |
| ENABLE | 10 kΩ to 3V3 |
| SIM_1V8 | 100 nF + 1 µF; 22 Ω on CLK/IO/RST; USBLC6-2 + PESD |
| ANT / GPS | IPEX + PESD5V0F1BL (~0.4 pF) |
| AUX | 49.9 Ω to GND |
| nRESET | 10 kΩ pull-up + 100 nF at SiP |
| LFXO | **Internal SiP** — select LFXO in firmware (not LFRC) |

Target: VDD pin impedance under 0.2 Ω from 10–50 kHz during LTE TX. Place bulk + FB next to SiP.

**Still layout-only:** 50 Ω ANT/GPS routes, GND stitching, NSMD/stencil (NWP-056), GNSS noise isolation, AC creepage. No AC MOV in catalog pick — fuse + IRM isolation only; add MOV on panel if site requires.

## MCU pin map

| Function | Pins |
|----------|------|
| RS-485 UART | P0.10 TX, P0.11 RX, P0.12 DE (/RE) |
| RS-232 UART | P0.13 TX, P0.14 RX |
| CAN SPI | P0.15 SCK, P0.16 MOSI, P0.17 MISO, P0.18 nCS, P0.19 nINT |
| I2C temp | P0.02 SDA, P0.03 SCL |
| VSYS ADC | P0.04 |

## Source

- [[file:main.ato]] — full design (`App`)

## Build

```bash
ato build
```
