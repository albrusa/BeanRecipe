"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Coffee, Settings, Scale, Play, Pause, RotateCcw, X,
  Plus, Edit2, Trash2, ChevronRight, CheckCircle,
  AlertCircle, Clock, Droplets, Flame, LogOut,
  ArrowLeft, ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import AuthForm from "./AuthForm";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type BrewMethodType = "v60" | "moka" | "aeropress";
type AeropressRecipe = "america" | "expres" | "latte" | "fred";

interface BrewMethod {
  id: string;
  type: BrewMethodType;
  grindClicks: number;
  notes: string;
}

interface CoffeeBean {
  id: string;
  name: string;
  origin: string;
  roaster: string;
  roastDate: string;
  process: string;
  notes: string;
  methods: BrewMethod[];
}

interface GrinderConfig {
  calibrationOffset: number;
  currentClick: number;
  clicksPerRotation: number;
}

interface RecipeStep {
  time: number;
  instruction: string;
  amount?: number;
  isAlert: boolean;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const DEFAULT_CLICKS_PER_ROTATION = 30;

const METHOD_LABEL: Record<BrewMethodType, string> = {
  v60: "V60", moka: "Moka", aeropress: "Aeropress",
};

const METHOD_BADGE: Record<BrewMethodType, string> = {
  v60: "bg-amber-100 text-amber-800 border border-amber-200",
  moka: "bg-red-100 text-red-800 border border-red-200",
  aeropress: "bg-sky-100 text-sky-800 border border-sky-200",
};

const AEROPRESS_LABELS: Record<AeropressRecipe, string> = {
  america: "Cafè Americà",
  expres:  "Estil Exprès",
  latte:   "Cafè Latte",
  fred:    "Cafè Fred ❄️",
};

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

function calcGrindPosition(clicks: number, offset: number, cpr: number = DEFAULT_CLICKS_PER_ROTATION): string {
  const total = clicks + offset;
  if (total < 0) return `${clicks} clics (fora de rang)`;
  const rotations = Math.floor(total / cpr);
  const rem = total % cpr;
  const parts: string[] = [];
  if (rotations === 1) parts.push("1 volta");
  else if (rotations > 1) parts.push(`${rotations} voltes`);
  parts.push(`Clic ${rem}`);
  return parts.join(" · ");
}

function buildV60Steps(water: number, ratio: number): RecipeStep[] {
  const coffee = water / ratio;
  const pour = water / 5;
  return [
    { time: 0,   instruction: `Posa ${coffee.toFixed(1)} g de cafè al filtre. 1r abocat: vessa ${pour.toFixed(0)} g d'aigua a 93 °C de manera circular.`, amount: pour, isAlert: true },
    { time: 45,  instruction: `2n abocat: vessa ${pour.toFixed(0)} g d'aigua. (Ajusta dolçor/acidesa.)`, amount: pour, isAlert: true },
    { time: 90,  instruction: `3r abocat: vessa ${pour.toFixed(0)} g d'aigua. (Comença la força.)`, amount: pour, isAlert: true },
    { time: 135, instruction: `4t abocat: vessa ${pour.toFixed(0)} g d'aigua.`, amount: pour, isAlert: true },
    { time: 180, instruction: `5è i darrer abocat: vessa ${pour.toFixed(0)} g d'aigua.`, amount: pour, isAlert: true },
    { time: 270, instruction: "El cafè ha acabat de drenar (±4–5 min totals). Gaudeix-ne!", isAlert: false },
  ];
}

function buildV60StandardSteps(water: number): RecipeStep[] {
  const coffee = water / 16;
  const preInfusion = Math.round(coffee * 3);
  const firstPourTarget = Math.round(water * 0.6);
  return [
    {
      time: 0,
      instruction: `Posa ${coffee.toFixed(1)} g de cafè al filtre. Aboca ${preInfusion} g d'aigua per fer la pre-infusió i remena suau perquè tot el cafè es mulli.`,
      amount: preInfusion,
      isAlert: true,
    },
    {
      time: 45,
      instruction: `Aboca constantment fent cercles fins a arribar als ${firstPourTarget} g.`,
      amount: firstPourTarget - preInfusion,
      isAlert: true,
    },
    {
      time: 75,
      instruction: `Aboca la resta d'aigua fins a arribar als ${water} g. En acabar, dona un petit moviment circular (swirl) al con.`,
      amount: water - firstPourTarget,
      isAlert: true,
    },
    {
      time: 105,
      instruction: "Deixa que s'escorri per gravetat. Hauria d'acabar prop del minut 2:30 o 3:00.",
      isAlert: false,
    },
    {
      time: 180,
      instruction: "El cafè ha acabat de drenar. Gaudeix-ne! ☕",
      isAlert: false,
    },
  ];
}

function buildAeropressAmericaSteps(): RecipeStep[] {
  return [
    { time: 0,  instruction: "Afegeix 15g de cafè (molta mitjana-fina). Aboca aigua a 85°C fins a la marca (4). Agita suaument per nivelar.", isAlert: true },
    { time: 10, instruction: "Remena durant 10 segons de forma suau però enèrgica.", isAlert: false },
    { time: 20, instruction: "Insereix l'èmbol aprox. 1 cm. Deixa reposar el cafè durant 30 segons.", isAlert: true },
    { time: 50, instruction: "Aplica una pressió suau i constant fins al final.", isAlert: true },
    { time: 80, instruction: "Cafè Americà llest! Gaudeix-ne. ☕", isAlert: false },
  ];
}

function buildAeropressExpresSteps(doble: boolean): RecipeStep[] {
  const grams = doble ? 30 : 15;
  const mark = doble ? 2 : 1;
  return [
    { time: 0,  instruction: `Afegeix ${grams}g de cafè (molta mitjana-fina). Aboca aigua a 85°C fins a la marca (${mark}).`, isAlert: true },
    { time: 10, instruction: "Remena suaument durant 10 segons.", isAlert: false },
    { time: 20, instruction: "Insereix l'èmbol 1 cm i deixa reposar 30 segons.", isAlert: true },
    { time: 50, instruction: "Premsa de forma suau i constant fins al final.", isAlert: true },
    { time: 80, instruction: `Exprès ${doble ? "doble" : "individual"} llest! ☕`, isAlert: false },
  ];
}

function buildAeropressLatteSteps(): RecipeStep[] {
  return [
    { time: 0,  instruction: "Afegeix 15g de cafè (molta mitjana-fina). Aboca aigua a 85°C fins a la marca (1).", isAlert: true },
    { time: 10, instruction: "Remena durant 10 segons.", isAlert: false },
    { time: 20, instruction: "Insereix l'èmbol 1 cm i deixa reposar 30 segons.", isAlert: true },
    { time: 50, instruction: "Premsa suaument fins a escoltar el xiulet de l'aire.", isAlert: true },
    { time: 80, instruction: "Retira la tapa del filtre per expulsar el pòls. Afegeix 240 ml de llet vaporitzada o escumada a la tassa. 🥛☕", isAlert: false },
  ];
}

function buildAeropressFredSteps(): RecipeStep[] {
  return [
    { time: 0,  instruction: "Afegeix 15g de cafè (molta mitjana-fina). Aboca AIGUA A TEMPERATURA AMBIENT fins a la marca (4).", isAlert: true },
    { time: 10, instruction: "Remena enèrgicament durant 1 minut sencer. No pares! ⏱", isAlert: false },
    { time: 60, instruction: "Insereix l'èmbol i aplica una pressió suau i constant.", isAlert: true },
    { time: 90, instruction: "Afegeix glaçons al gust i serveix directament. ❄️☕", isAlert: false },
  ];
}

function buildAeropressStepsForRecipe(recipe: AeropressRecipe, doble: boolean): RecipeStep[] {
  switch (recipe) {
    case "america": return buildAeropressAmericaSteps();
    case "expres":  return buildAeropressExpresSteps(doble);
    case "latte":   return buildAeropressLatteSteps();
    case "fred":    return buildAeropressFredSteps();
  }
}

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────
// SUPABASE DATA LAYER
// ─────────────────────────────────────────────

async function dbFetchCoffees(userId: string): Promise<CoffeeBean[]> {
  const { data, error } = await supabase
    .from("coffees")
    .select("id, name, origin, roaster, roast_date, process, notes, brew_methods(id, type, grind_clicks, notes)")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    origin: row.origin,
    roaster: row.roaster,
    roastDate: row.roast_date ?? "",
    process: row.process,
    notes: row.notes,
    methods: ((row.brew_methods as unknown as Array<{ id: string; type: string; grind_clicks: number; notes: string }>) ?? []).map((m) => ({
      id: m.id,
      type: m.type as BrewMethodType,
      grindClicks: m.grind_clicks,
      notes: m.notes,
    })),
  }));
}

async function dbFetchGrinderConfig(userId: string): Promise<GrinderConfig | null> {
  const { data } = await supabase
    .from("grinder_config")
    .select("calibration_offset, current_click, clicks_per_rotation")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? {
    calibrationOffset: data.calibration_offset,
    currentClick: data.current_click ?? 0,
    clicksPerRotation: data.clicks_per_rotation ?? DEFAULT_CLICKS_PER_ROTATION,
  } : null;
}

async function dbUpsertCoffee(coffee: CoffeeBean, userId: string): Promise<void> {
  const { error } = await supabase.from("coffees").upsert({
    id: coffee.id,
    user_id: userId,
    name: coffee.name,
    origin: coffee.origin,
    roaster: coffee.roaster,
    roast_date: coffee.roastDate || null,
    process: coffee.process,
    notes: coffee.notes,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function dbDeleteCoffee(id: string): Promise<void> {
  const { error } = await supabase.from("coffees").delete().eq("id", id);
  if (error) throw error;
}

async function dbUpsertMethod(method: BrewMethod, coffeeId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("brew_methods").upsert({
    id: method.id,
    coffee_id: coffeeId,
    user_id: userId,
    type: method.type,
    grind_clicks: method.grindClicks,
    notes: method.notes,
  });
  if (error) throw error;
}

async function dbDeleteMethod(id: string): Promise<void> {
  const { error } = await supabase.from("brew_methods").delete().eq("id", id);
  if (error) throw error;
}

async function dbSaveGrinderConfig(config: GrinderConfig, userId: string): Promise<void> {
  const { error } = await supabase.from("grinder_config").upsert({
    user_id: userId,
    calibration_offset: config.calibrationOffset,
    current_click: config.currentClick,
    clicks_per_rotation: config.clicksPerRotation,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ─────────────────────────────────────────────
// DIAL HELPERS
// ─────────────────────────────────────────────

function clickToAngleDeg(click: number, cpr: number): number {
  return ((click % cpr) / cpr) * 360 - 90;
}

function polarToXY(cx: number, cy: number, angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ─────────────────────────────────────────────
// GRINDER DIAL SVG
// ─────────────────────────────────────────────

function GrinderDial({
  currentClick,
  calibrationOffset,
  clicksPerRotation,
  size = 200,
}: {
  currentClick: number;
  calibrationOffset: number;
  clicksPerRotation: number;
  size?: number;
}) {
  const cpr = clicksPerRotation;
  const cx = size / 2, cy = size / 2;
  const outerR   = size * 0.46;
  const innerR   = size * 0.30;
  const tickOutR = outerR - 2;
  const markerR  = tickOutR - size * 0.075;
  const majorEvery = Math.max(1, Math.round(cpr / 10));

  const mechZeroPos   = calibrationOffset % cpr;
  const mechZeroAngle = clickToAngleDeg(mechZeroPos, cpr);
  const mechZeroPt    = polarToXY(cx, cy, mechZeroAngle, markerR);

  const physicalPos  = ((currentClick + calibrationOffset) % cpr + cpr) % cpr;
  const currentAngle = clickToAngleDeg(physicalPos, cpr);
  const currentPt    = polarToXY(cx, cy, currentAngle, markerR);

  const total     = currentClick + calibrationOffset;
  const isValid   = total >= 0;
  const rotations = isValid ? Math.floor(total / cpr) : 0;
  const withinRot = isValid ? total % cpr : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle cx={cx} cy={cy} r={outerR} fill="#f5f5f4" stroke="#d6d3d1" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={innerR} fill="white" stroke="#e7e5e4" strokeWidth={1} />

      {Array.from({ length: cpr }, (_, i) => {
        const angle = (i / cpr) * 360 - 90;
        const isMaj = i % majorEvery === 0;
        const len   = isMaj ? size * 0.065 : size * 0.03;
        const outer = polarToXY(cx, cy, angle, tickOutR);
        const inner = polarToXY(cx, cy, angle, tickOutR - len);
        return (
          <line key={i} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
            stroke={isMaj ? "#78716c" : "#d6d3d1"}
            strokeWidth={isMaj ? 1.5 : 1} strokeLinecap="round" />
        );
      })}

      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i * majorEvery / cpr) * 360 - 90;
        const pos   = polarToXY(cx, cy, angle, tickOutR - size * 0.1);
        return (
          <text key={i} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.057} fontWeight="600" fill="#57534e"
            style={{ userSelect: "none" }}>{i * majorEvery}</text>
        );
      })}

      {/* Mechanical zero (red) */}
      <circle cx={mechZeroPt.x} cy={mechZeroPt.y} r={size * 0.028} fill="#ef4444" />
      <circle cx={mechZeroPt.x} cy={mechZeroPt.y} r={size * 0.013} fill="white" />

      {/* Current position (blue) */}
      <circle cx={currentPt.x} cy={currentPt.y} r={size * 0.05} fill="#3b82f6" />
      <circle cx={currentPt.x} cy={currentPt.y} r={size * 0.023} fill="white" />

      {isValid ? (
        <>
          {rotations > 0 && (
            <text x={cx} y={cy - size * 0.12} textAnchor="middle"
              fontSize={size * 0.05} fontWeight="600" fill="#78716c">
              {rotations} volta{rotations > 1 ? "es" : ""}
            </text>
          )}
          <text x={cx} y={cy + (rotations > 0 ? size * 0.03 : 0)} textAnchor="middle"
            dominantBaseline="middle" fontSize={size * 0.11} fontWeight="800" fill="#1c1917">
            {withinRot}
          </text>
          <text x={cx} y={cy + size * 0.1} textAnchor="middle"
            fontSize={size * 0.047} fill="#a8a29e">
            / {cpr} clics
          </text>
        </>
      ) : (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
          fontSize={size * 0.06} fill="#ef4444">fora rang</text>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────
// GRIND MOVEMENT DIAL (animated)
// ─────────────────────────────────────────────

function GrindMovementDial({
  currentClicks,
  targetClicks,
  offset,
  clicksPerRotation,
  size = 168,
}: {
  currentClicks: number;
  targetClicks: number;
  offset: number;
  clicksPerRotation: number;
  size?: number;
}) {
  const cpr      = clicksPerRotation;
  const diff     = targetClicks - currentClicks;
  const goRight  = diff < 0;
  const absDiff  = Math.abs(diff);
  const fullRevs = Math.floor(absDiff / cpr);
  const remClicks = absDiff % cpr;

  const cx = size / 2, cy = size / 2;
  const outerR   = size * 0.45;
  const innerR   = size * 0.28;
  const tickOutR = outerR - 2;
  const arcR     = size * 0.335;
  const majorEvery = Math.max(1, Math.round(cpr / 10));

  const sweepClicks = remClicks === 0 ? cpr : remClicks;
  const sweepAngle  = Math.min((sweepClicks / cpr) * 360, 359.5);
  const arcLength   = (sweepAngle / 360) * 2 * Math.PI * arcR;

  const rafRef = useRef<number>(0);
  const [dashOffset, setDashOffset] = useState(arcLength);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    setDashOffset(arcLength);
    const t0 = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - t0) / 900, 1);
      const e = 1 - Math.pow(1 - t, 3);
      setDashOffset(arcLength * (1 - e));
      if (t < 1) { rafRef.current = requestAnimationFrame(animate); }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [currentClicks, targetClicks, arcLength]);

  // Use physical ring positions so dots match what the user sees on the grinder
  const currentPhysical = ((currentClicks + offset) % cpr + cpr) % cpr;
  const targetPhysical  = ((targetClicks  + offset) % cpr + cpr) % cpr;

  const currentAngle = clickToAngleDeg(currentPhysical, cpr);
  const targetAngle  = clickToAngleDeg(targetPhysical, cpr);
  const endAngle     = goRight ? currentAngle + sweepAngle : currentAngle - sweepAngle;

  const startPt     = polarToXY(cx, cy, currentAngle, arcR);
  const endPt       = polarToXY(cx, cy, endAngle, arcR);
  const targetDotPt = polarToXY(cx, cy, targetAngle, arcR);

  const largeArc  = sweepAngle > 180 ? 1 : 0;
  const sweepFlag = goRight ? 1 : 0;
  const arcPath   = `M ${startPt.x} ${startPt.y} A ${arcR} ${arcR} 0 ${largeArc} ${sweepFlag} ${endPt.x} ${endPt.y}`;

  const tangentAngle = goRight ? endAngle + 90 : endAngle - 90;
  const arrowLen = size * 0.065;
  const backAngle = tangentAngle + 180;
  const arrowL = {
    x: endPt.x + arrowLen * Math.cos(((backAngle + 28) * Math.PI) / 180),
    y: endPt.y + arrowLen * Math.sin(((backAngle + 28) * Math.PI) / 180),
  };
  const arrowR2 = {
    x: endPt.x + arrowLen * Math.cos(((backAngle - 28) * Math.PI) / 180),
    y: endPt.y + arrowLen * Math.sin(((backAngle - 28) * Math.PI) / 180),
  };
  const arrowOpacity = arcLength > 0 ? Math.max(0, 1 - dashOffset / arcLength) : 1;

  const color = goRight ? "#0ea5e9" : "#f97316";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle cx={cx} cy={cy} r={outerR} fill="#f5f5f4" stroke="#d6d3d1" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={innerR} fill="white" stroke="#e7e5e4" strokeWidth={1} />

      {Array.from({ length: cpr }, (_, i) => {
        const angle = (i / cpr) * 360 - 90;
        const isMaj = i % majorEvery === 0;
        const len   = isMaj ? size * 0.055 : size * 0.025;
        const outer = polarToXY(cx, cy, angle, tickOutR);
        const inner = polarToXY(cx, cy, angle, tickOutR - len);
        return (
          <line key={i} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
            stroke={isMaj ? "#a8a29e" : "#e2e0dd"}
            strokeWidth={isMaj ? 1.5 : 1} strokeLinecap="round" />
        );
      })}

      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i * majorEvery / cpr) * 360 - 90;
        const pos   = polarToXY(cx, cy, angle, tickOutR - size * 0.09);
        return (
          <text key={i} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.052} fontWeight="600" fill="#a8a29e"
            style={{ userSelect: "none" }}>{i * majorEvery}</text>
        );
      })}

      {/* Ghost arc track */}
      <path d={arcPath} fill="none" stroke={color} strokeWidth={size * 0.032}
        strokeLinecap="round" opacity={0.12} />

      {/* Animated arc */}
      <path d={arcPath} fill="none" stroke={color}
        strokeWidth={size * 0.038} strokeLinecap="round"
        strokeDasharray={arcLength} strokeDashoffset={dashOffset} />

      {/* Arrowhead at end (fades in) */}
      <polygon
        points={`${endPt.x},${endPt.y} ${arrowL.x},${arrowL.y} ${arrowR2.x},${arrowR2.y}`}
        fill={color} opacity={arrowOpacity} />

      {/* Start dot (current — blue) */}
      <circle cx={startPt.x} cy={startPt.y} r={size * 0.052} fill="#3b82f6" />
      <circle cx={startPt.x} cy={startPt.y} r={size * 0.024} fill="white" />

      {/* End dot (target — arc color) */}
      <circle cx={targetDotPt.x} cy={targetDotPt.y} r={size * 0.044} fill={color} opacity={0.3} />
      <circle cx={targetDotPt.x} cy={targetDotPt.y} r={size * 0.027} fill={color} />

      {/* Center: click count + revolutions */}
      <text x={cx} y={cy - (fullRevs > 0 ? size * 0.06 : 0)} textAnchor="middle"
        dominantBaseline="middle" fontSize={size * 0.11} fontWeight="800" fill={color}>
        {absDiff}
      </text>
      {fullRevs > 0 && (
        <text x={cx} y={cy + size * 0.1} textAnchor="middle"
          fontSize={size * 0.049} fill="#78716c">
          {fullRevs} volta{fullRevs > 1 ? "es" : ""}
        </text>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────
// GRIND MOVEMENT INSTRUCTION
// ─────────────────────────────────────────────

function GrindMovementInstruction({
  targetClicks,
  currentClicks,
  offset,
  clicksPerRotation,
  onApply,
}: {
  targetClicks: number;
  currentClicks: number;
  offset: number;
  clicksPerRotation: number;
  onApply: () => void;
}) {
  const diff = targetClicks - currentClicks;
  const absDiff = Math.abs(diff);
  const targetPos = calcGrindPosition(targetClicks, offset, clicksPerRotation);

  if (diff === 0) {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="font-extrabold text-green-800">Molinet a punt! ✨</p>
          <p className="text-green-600 text-xs mt-0.5">{targetPos}</p>
        </div>
      </div>
    );
  }

  // diff < 0 → finer → clockwise → DRETA
  // diff > 0 → coarser → counterclockwise → ESQUERRA
  const goRight = diff < 0;

  return (
    <div className={`rounded-2xl border-2 p-4 ${goRight ? "bg-sky-50 border-sky-200" : "bg-orange-50 border-orange-200"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${goRight ? "text-sky-500" : "text-orange-500"}`}>
        {goRight ? "Molenda més fina · Tanca el molinet ↻" : "Molenda més gruixuda · Obre el molinet ↺"}
      </p>

      {/* Animated movement dial */}
      <div className="flex justify-center mb-3">
        <GrindMovementDial currentClicks={currentClicks} targetClicks={targetClicks} offset={offset} clicksPerRotation={clicksPerRotation} size={168} />
      </div>

      {/* Direction row */}
      <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mb-3 ${goRight ? "bg-sky-100" : "bg-orange-100"}`}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${goRight ? "bg-sky-500" : "bg-orange-500"}`}>
          {goRight
            ? <ArrowRight className="w-5 h-5 text-white" strokeWidth={2.5} />
            : <ArrowLeft  className="w-5 h-5 text-white" strokeWidth={2.5} />
          }
        </div>
        <div className="flex-1">
          <p className={`font-extrabold text-sm leading-tight ${goRight ? "text-sky-800" : "text-orange-800"}`}>
            {absDiff} clics a la {goRight ? "DRETA" : "ESQUERRA"}
          </p>
          <p className={`text-xs mt-0.5 ${goRight ? "text-sky-600" : "text-orange-600"}`}>
            Destí: <span className="font-semibold">{targetPos}</span>
          </p>
        </div>
      </div>

      <button
        onClick={onApply}
        className={`w-full py-3 rounded-xl font-bold text-sm text-white transition-colors flex items-center justify-center gap-2 ${goRight ? "bg-sky-600 hover:bg-sky-700" : "bg-orange-600 hover:bg-orange-700"}`}
      >
        <CheckCircle className="w-4 h-4" /> Aplicar aquesta molta
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// GRINDER SECTION
// ─────────────────────────────────────────────

function GrinderSection({ cfg, onSave }: { cfg: GrinderConfig; onSave: (c: GrinderConfig) => void }) {
  const [editing, setEditing] = useState(false);
  const [offsetVal, setOffsetVal] = useState(String(cfg.calibrationOffset));
  const [cprVal, setCprVal] = useState(String(cfg.clicksPerRotation));
  const [editingCurrent, setEditingCurrent] = useState(false);
  const [currentVal, setCurrentVal] = useState(String(cfg.currentClick));
  const cpr = cfg.clicksPerRotation;
  const currentPos = calcGrindPosition(cfg.currentClick, cfg.calibrationOffset, cpr);

  const save = () => {
    onSave({
      ...cfg,
      calibrationOffset: parseInt(offsetVal) || 0,
      clicksPerRotation: Math.max(1, parseInt(cprVal) || DEFAULT_CLICKS_PER_ROTATION),
    });
    setEditing(false);
  };

  const saveCurrent = () => {
    onSave({ ...cfg, currentClick: parseInt(currentVal) || 0 });
    setEditingCurrent(false);
  };

  return (
    <div className="space-y-4">
      {/* Posició actual */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-stone-100">
          <div>
            <h3 className="font-bold text-stone-700 text-sm">Posició actual del molinet</h3>
            <p className="text-xs text-stone-400 mt-0.5">Última posició confirmada</p>
          </div>
          <button
            onClick={() => { setEditingCurrent((v) => !v); setCurrentVal(String(cfg.currentClick)); }}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
          >
            {editingCurrent ? "Cancel·lar" : "Actualitzar"}
          </button>
        </div>
        {editingCurrent ? (
          <div className="p-5 space-y-4">
            {/* Live-preview dial while editing */}
            <div className="flex justify-center">
              <GrinderDial
                currentClick={parseInt(currentVal) || 0}
                calibrationOffset={cfg.calibrationOffset}
                clicksPerRotation={cpr}
                size={172}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1.5">Clics totals actuals</label>
              <div className="flex gap-3 items-center">
                <input
                  type="range" min={0} max={90}
                  value={parseInt(currentVal) || 0}
                  onChange={(e) => setCurrentVal(e.target.value)}
                  className="flex-1"
                />
                <input
                  type="number" min={0}
                  value={currentVal}
                  onChange={(e) => setCurrentVal(e.target.value)}
                  className="w-16 border border-stone-200 rounded-xl px-3 py-2 text-stone-800 text-center focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm font-bold"
                />
              </div>
            </div>
            <button onClick={saveCurrent} className="w-full bg-amber-800 text-white rounded-xl py-3 text-sm font-semibold hover:bg-amber-900 transition-colors">
              Guardar posició actual
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="flex justify-center">
              <GrinderDial
                currentClick={cfg.currentClick}
                calibrationOffset={cfg.calibrationOffset}
                clicksPerRotation={cpr}
                size={192}
              />
            </div>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                <span>Posició actual</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                <span>Zero mecànic</span>
              </div>
            </div>
            <p className="text-center text-sm font-bold text-amber-700 bg-amber-50 rounded-xl py-2 border border-amber-100">
              {currentPos}
            </p>
          </div>
        )}
      </div>

      {/* Configuració del molinet */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-stone-800 to-stone-700 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Settings className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h2 className="font-bold text-white">Molinet</h2>
                <p className="text-stone-400 text-xs">{cpr} clics/volta · calibració {cfg.calibrationOffset >= 0 ? "+" : ""}{cfg.calibrationOffset}</p>
              </div>
            </div>
            <button
              onClick={() => { setEditing((v) => !v); setOffsetVal(String(cfg.calibrationOffset)); setCprVal(String(cfg.clicksPerRotation)); }}
              className="text-xs text-amber-300 hover:text-amber-200 font-medium px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              {editing ? "Cancel·lar" : "Editar"}
            </button>
          </div>
        </div>

        <div className="p-5">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1.5">
                  Clics per volta
                </label>
                <input
                  type="number" min={1} max={200}
                  value={cprVal}
                  onChange={(e) => setCprVal(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  placeholder="30"
                />
                <p className="text-xs text-stone-400 mt-1.5">
                  Nombre de clics que fa el molinet per cada rotació completa.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1.5">
                  Calibració (zero mecànic, en clics)
                </label>
                <input
                  type="number"
                  value={offsetVal}
                  onChange={(e) => setOffsetVal(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-4 py-3 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  placeholder="0"
                />
                <p className="text-xs text-stone-400 mt-1.5">
                  Clics del ring on les moles es toquen. Negatiu si hi ha joc mecànic.
                </p>
              </div>
              <button onClick={save} className="w-full bg-stone-800 text-white rounded-xl py-3 text-sm font-semibold hover:bg-stone-900 transition-colors">
                Guardar configuració
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-stone-50 rounded-xl p-3 text-center border border-stone-100">
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-1">Clics / volta</p>
                <p className="text-2xl font-extrabold text-stone-700">{cpr}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                <p className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold mb-1">Zero mecànic</p>
                <p className="text-2xl font-extrabold text-amber-900">
                  {cfg.calibrationOffset >= 0 ? "+" : ""}{cfg.calibrationOffset}
                </p>
                <p className="text-xs text-amber-600">clics</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
        <h3 className="font-semibold text-amber-900 text-sm mb-3">Com llegir la posició</h3>
        <div className="space-y-2 text-sm text-amber-800">
          {[
            ["Voltes completes", "Rotacions senceres des del zero mecànic."],
            ["Clic X / Y", "Posició dins la volta actual (X de Y clics totals)."],
          ].map(([t, d]) => (
            <div key={t} className="flex gap-2">
              <span className="font-semibold flex-shrink-0">{t}:</span>
              <span className="text-amber-700/80">{d}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-amber-100 rounded-xl p-3 text-xs text-amber-700 font-mono">
          Ex: 47 clics (cpr=30, cal=8) → 1 volta · Clic 25
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COFFEE FORM MODAL
// ─────────────────────────────────────────────

function CoffeeFormModal({ coffee, onSave, onClose }: { coffee?: CoffeeBean; onSave: (c: CoffeeBean) => void; onClose: () => void }) {
  const [f, setF] = useState({
    name: coffee?.name ?? "", origin: coffee?.origin ?? "", roaster: coffee?.roaster ?? "",
    roastDate: coffee?.roastDate ?? "", process: coffee?.process ?? "", notes: coffee?.notes ?? "",
  });
  const set = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  const fields: Array<[string, string, string]> = [
    ["name", "Nom *", "ex: Ethiopia Yirgacheffe Kochere"],
    ["origin", "Origen", "ex: Etiòpia, comarca Sidama"],
    ["roaster", "Torredor", "ex: Nomad Coffee, Right Side Coffee"],
    ["process", "Procés", "ex: Natural, Rentat, Honey, Anaerobi"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3 sm:p-6">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-800 text-lg">{coffee ? "Editar cafè" : "Afegir nou cafè"}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {fields.map(([k, label, ph]) => (
            <div key={k}>
              <label className="text-sm font-medium text-stone-600 block mb-1.5">{label}</label>
              <input value={(f as Record<string, string>)[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph}
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-stone-300" />
            </div>
          ))}
          <div>
            <label className="text-sm font-medium text-stone-600 block mb-1.5">Data de torrat</label>
            <input type="date" value={f.roastDate} onChange={(e) => set("roastDate", e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-600 block mb-1.5">Notes personals</label>
            <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)}
              placeholder="Sabors, aromes, valoració, maridatge..." rows={3}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none placeholder:text-stone-300" />
          </div>
        </div>
        <div className="p-5 border-t border-stone-100">
          <button disabled={!f.name.trim()}
            onClick={() => onSave({ id: coffee?.id ?? crypto.randomUUID(), ...f, methods: coffee?.methods ?? [] })}
            className="w-full bg-amber-800 text-white rounded-xl py-3.5 font-bold disabled:opacity-40 hover:bg-amber-900 transition-colors">
            {coffee ? "Guardar canvis" : "Afegir cafè"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// METHOD FORM MODAL
// ─────────────────────────────────────────────

function MethodFormModal({ method, onSave, onClose }: { method?: BrewMethod; onSave: (m: BrewMethod) => void; onClose: () => void }) {
  const [type, setType] = useState<BrewMethodType>(method?.type ?? "v60");
  const [clicks, setClicks] = useState(String(method?.grindClicks ?? 20));
  const [notes, setNotes] = useState(method?.notes ?? "");

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-3 sm:p-6">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-800">{method ? "Editar mètode" : "Nou mètode de preparació"}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-stone-400" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="text-sm font-medium text-stone-600 block mb-2">Tipus de preparació</label>
            <div className="grid grid-cols-3 gap-2">
              {(["v60", "moka", "aeropress"] as BrewMethodType[]).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${type === t ? "bg-stone-800 text-white border-stone-800" : "bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-300"}`}>
                  {METHOD_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-stone-600 block mb-1.5">Grau de moltura (clics totals)</label>
            <div className="flex gap-3 items-center">
              <input type="range" min={0} max={90} value={parseInt(clicks) || 0} onChange={(e) => setClicks(e.target.value)} className="flex-1" />
              <input type="number" min={0} value={clicks} onChange={(e) => setClicks(e.target.value)}
                className="w-16 border border-stone-200 rounded-xl px-3 py-2 text-stone-800 text-center focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm font-bold" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-stone-600 block mb-1.5">Notes (opcional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Temperatura, variació, observació..."
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm placeholder:text-stone-300" />
          </div>
          <button onClick={() => onSave({ id: method?.id ?? crypto.randomUUID(), type, grindClicks: parseInt(clicks) || 0, notes })}
            className="w-full bg-amber-800 text-white rounded-xl py-3.5 font-bold hover:bg-amber-900 transition-colors">
            {method ? "Guardar" : "Afegir mètode"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PREPARE QUICK MODAL
// ─────────────────────────────────────────────

const AEROPRESS_COFFEE: Record<AeropressRecipe, number> = { america: 15, expres: 15, latte: 15, fred: 15 };
const AEROPRESS_MARK: Record<AeropressRecipe, number | null> = { america: 4, expres: 1, latte: 1, fred: 4 };
const AEROPRESS_TEMP: Record<AeropressRecipe, string> = { america: "85 °C", expres: "85 °C", latte: "85 °C", fred: "Temp. ambient" };

function PrepareQuickModal({ method, coffeeName, onStart, onClose }: {
  method: BrewMethod; coffeeName: string;
  onStart: (steps: RecipeStep[], title: string) => void; onClose: () => void;
}) {
  const [water, setWater] = useState(300);
  const [ratio, setRatio] = useState(15);
  const [v60Recipe, setV60Recipe] = useState<"46" | "standard">("46");
  const [aeropressRecipe, setAeropressRecipe] = useState<AeropressRecipe>("america");
  const [aeropressDoble, setAeropressDoble] = useState(false);

  const isAeropress = method.type === "aeropress";

  const coffeeg = isAeropress
    ? (aeropressRecipe === "expres" && aeropressDoble ? 30 : AEROPRESS_COFFEE[aeropressRecipe])
    : v60Recipe === "standard"
    ? (water / 16).toFixed(1)
    : (water / ratio).toFixed(1);

  const aeropressMark = aeropressRecipe === "expres" && aeropressDoble ? 2 : AEROPRESS_MARK[aeropressRecipe];

  const handleStart = () => {
    let steps: RecipeStep[];
    let title: string;
    if (method.type === "v60") {
      steps = v60Recipe === "standard" ? buildV60StandardSteps(water) : buildV60Steps(water, ratio);
      title = `${v60Recipe === "standard" ? "V60 Estàndard" : "V60 4:6"} · ${coffeeName}`;
    } else {
      steps = buildAeropressStepsForRecipe(aeropressRecipe, aeropressDoble);
      title = `Aeropress ${AEROPRESS_LABELS[aeropressRecipe]}${aeropressRecipe === "expres" && aeropressDoble ? " Doble" : ""} · ${coffeeName}`;
    }
    onStart(steps, title);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-3 sm:p-6">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div>
            <h3 className="font-bold text-stone-800">Preparar {METHOD_LABEL[method.type]}</h3>
            <p className="text-xs text-stone-400 mt-0.5">{coffeeName}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-stone-400" /></button>
        </div>
        <div className="p-5 space-y-5">
          {method.type === "v60" && (
            <div className="flex rounded-xl border border-stone-200 overflow-hidden">
              {(["46", "standard"] as const).map((r) => (
                <button key={r} onClick={() => setV60Recipe(r)}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${v60Recipe === r ? "bg-amber-50 text-amber-800 border-b-2 border-amber-700" : "text-stone-400 hover:text-stone-600 hover:bg-stone-50"}`}>
                  {r === "46" ? "4:6 · Kasuya" : "Estàndard · 2 Aboc."}
                </button>
              ))}
            </div>
          )}
          {isAeropress && (
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(AEROPRESS_LABELS) as AeropressRecipe[]).map((r) => (
                <button key={r} onClick={() => setAeropressRecipe(r)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border ${aeropressRecipe === r ? "bg-sky-700 text-white border-sky-700" : "bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-300"}`}>
                  {AEROPRESS_LABELS[r]}
                </button>
              ))}
            </div>
          )}
          {isAeropress && aeropressRecipe === "expres" && (
            <div className="flex rounded-xl border border-stone-200 overflow-hidden">
              {([false, true] as const).map((d) => (
                <button key={String(d)} onClick={() => setAeropressDoble(d)}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${aeropressDoble === d ? "bg-sky-50 text-sky-800 border-b-2 border-sky-700" : "text-stone-400 hover:text-stone-600 hover:bg-stone-50"}`}>
                  {d ? "Doble · 30g" : "Individual · 15g"}
                </button>
              ))}
            </div>
          )}
          {!isAeropress && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-stone-600">Volum d'aigua</label>
                <div className="flex items-center gap-1">
                  <input type="number" value={water} min={50} max={800} onChange={(e) => setWater(Number(e.target.value))}
                    className="w-16 border border-stone-200 rounded-lg px-2 py-1 text-sm text-stone-800 text-right focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <span className="text-sm text-stone-400">ml</span>
                </div>
              </div>
              <input type="range" min={50} max={600} step={10} value={water} onChange={(e) => setWater(Number(e.target.value))} className="w-full" />
            </div>
          )}
          {method.type === "v60" && v60Recipe === "46" && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-stone-600">Ràtio</label>
                <span className="text-sm font-bold text-amber-700">1:{ratio}</span>
              </div>
              <input type="range" min={12} max={20} step={0.5} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} className="w-full" />
              <div className="flex justify-between text-xs text-stone-400 mt-1"><span>1:12 (fort)</span><span>1:20 (suau)</span></div>
            </div>
          )}
          {method.type === "v60" && v60Recipe === "standard" && (
            <div className="flex items-center justify-between py-2 px-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-sm text-stone-500">Ràtio fixe</span>
              <span className="text-sm font-bold text-amber-700">1:16</span>
            </div>
          )}
          {isAeropress ? (
            <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-sky-500/70 uppercase tracking-wide mb-1">Cafè</p>
                <p className="text-2xl font-extrabold text-sky-900">{coffeeg}</p>
                <p className="text-xs text-sky-600">g</p>
              </div>
              <div>
                <p className="text-[10px] text-sky-500/70 uppercase tracking-wide mb-1">Marca</p>
                <p className="text-2xl font-extrabold text-sky-900">{aeropressMark}</p>
                <p className="text-xs text-sky-600">al tub</p>
              </div>
              <div>
                <p className="text-[10px] text-sky-500/70 uppercase tracking-wide mb-1">Temp.</p>
                <p className="text-lg font-extrabold text-sky-900 leading-tight mt-1">{AEROPRESS_TEMP[aeropressRecipe]}</p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 rounded-2xl p-4 flex justify-around border border-amber-100">
              <div className="text-center">
                <p className="text-xs text-amber-600/70 uppercase tracking-wide mb-1">Cafè</p>
                <p className="text-3xl font-extrabold text-amber-900">{coffeeg}</p>
                <p className="text-xs text-amber-700">grams</p>
              </div>
              <div className="w-px bg-amber-200" />
              <div className="text-center">
                <p className="text-xs text-amber-600/70 uppercase tracking-wide mb-1">Aigua</p>
                <p className="text-3xl font-extrabold text-amber-900">{water}</p>
                <p className="text-xs text-amber-700">ml / g</p>
              </div>
            </div>
          )}
          <button onClick={handleStart}
            className="w-full flex items-center justify-center gap-2.5 bg-amber-800 text-white rounded-xl py-4 font-bold text-base hover:bg-amber-900 transition-colors shadow-md shadow-amber-800/20">
            <Play className="w-5 h-5" /> Iniciar temporitzador
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COFFEE DETAIL PANEL
// ─────────────────────────────────────────────

function CoffeeDetailPanel({ coffee, grinderCfg, onClose, onEditCoffee, onDeleteCoffee, onAddMethod, onEditMethod, onDeleteMethod, onPrepare, onApplyGrind }: {
  coffee: CoffeeBean; grinderCfg: GrinderConfig; onClose: () => void;
  onEditCoffee: () => void; onDeleteCoffee: () => void;
  onAddMethod: (m: BrewMethod) => void; onEditMethod: (m: BrewMethod) => void;
  onDeleteMethod: (id: string) => void;
  onPrepare: (steps: RecipeStep[], title: string, grindClicks?: number) => void;
  onApplyGrind: (clicks: number) => void;
}) {
  const [methodModal, setMethodModal] = useState<{ open: boolean; editing?: BrewMethod }>({ open: false });
  const [prepareModal, setPrepareModal] = useState<BrewMethod | null>(null);

  return (
    <>
      <div className="fixed inset-0 z-40 flex">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative ml-auto w-full max-w-lg bg-stone-50 flex flex-col h-full shadow-2xl">
          <div className="bg-gradient-to-br from-amber-900 to-amber-800 text-white px-4 pt-6 pb-5">
            <div className="flex items-start justify-between gap-3">
              <button onClick={onClose} className="mt-0.5 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 flex-shrink-0"><X className="w-4 h-4" /></button>
              <div className="flex-1 min-w-0">
                <h2 className="font-extrabold text-xl leading-tight">{coffee.name}</h2>
                {(coffee.roaster || coffee.origin) && (
                  <p className="text-amber-200 text-sm mt-1">{[coffee.roaster, coffee.origin].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0 mt-0.5">
                <button onClick={onEditCoffee} className="flex items-center gap-1 text-xs text-amber-200 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 font-medium">
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => { if (confirm(`Eliminar "${coffee.name}"?`)) onDeleteCoffee(); }}
                  className="flex items-center gap-1 text-xs text-red-300 hover:text-red-100 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 font-medium">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {coffee.roastDate && <span className="text-xs bg-white/15 px-2.5 py-1 rounded-full font-medium">🗓 {coffee.roastDate}</span>}
              {coffee.process && <span className="text-xs bg-white/15 px-2.5 py-1 rounded-full font-medium">{coffee.process}</span>}
            </div>
            {coffee.notes && <p className="text-amber-100/70 text-sm mt-3 italic leading-snug">"{coffee.notes}"</p>}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-600 text-xs uppercase tracking-widest">Mètodes de preparació</h3>
              <button onClick={() => setMethodModal({ open: true })} className="flex items-center gap-1.5 text-sm text-amber-700 font-semibold hover:text-amber-900">
                <Plus className="w-4 h-4" /> Afegir
              </button>
            </div>

            {coffee.methods.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-stone-400">
                <Coffee className="w-14 h-14 mb-4 opacity-20" />
                <p className="font-semibold text-sm">Sense mètodes guardats</p>
                <p className="text-xs mt-1 text-stone-400 text-center max-w-[200px]">Afegeix el grau de moltura per a cada preparació.</p>
                <button onClick={() => setMethodModal({ open: true })} className="mt-5 bg-amber-800 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-amber-900">
                  Afegir primer mètode
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {coffee.methods.map((m) => {
                  const pos = calcGrindPosition(m.grindClicks, grinderCfg.calibrationOffset, grinderCfg.clicksPerRotation);
                  const canPrepare = m.type === "v60" || m.type === "aeropress";
                  return (
                    <div key={m.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between border-b border-stone-100">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${METHOD_BADGE[m.type]}`}>{METHOD_LABEL[m.type]}</span>
                        <div className="flex gap-2">
                          <button onClick={() => setMethodModal({ open: true, editing: m })} className="text-stone-300 hover:text-amber-700 transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm("Eliminar aquest mètode?")) onDeleteMethod(m.id); }} className="text-stone-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-stone-400">Moltura objectiu</span>
                          <span className="font-bold text-stone-700">{m.grindClicks} clics</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-stone-400">Posició al dial</span>
                          <span className="font-bold text-amber-700">{pos}</span>
                        </div>
                        {m.notes && <p className="text-xs text-stone-400 italic pt-1">{m.notes}</p>}
                      </div>
                      <div className="px-4 pb-3">
                        <GrindMovementInstruction
                          targetClicks={m.grindClicks}
                          currentClicks={grinderCfg.currentClick}
                          offset={grinderCfg.calibrationOffset}
                          clicksPerRotation={grinderCfg.clicksPerRotation}
                          onApply={() => onApplyGrind(m.grindClicks)}
                        />
                      </div>
                      {canPrepare && (
                        <div className="px-4 pb-3">
                          <button onClick={() => setPrepareModal(m)}
                            className="w-full flex items-center justify-center gap-2 bg-amber-800 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-amber-900 transition-colors">
                            <Play className="w-4 h-4" /> Preparar ara
                          </button>
                        </div>
                      )}
                      {m.type === "moka" && (
                        <div className="mx-4 mb-3 bg-red-50 rounded-xl px-3 py-2 flex items-center gap-2">
                          <Flame className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <p className="text-xs text-red-600">La Moka no disposa de temporitzador guiat. Usa el grau de moltura com a referència.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {methodModal.open && (
        <MethodFormModal method={methodModal.editing}
          onSave={(m) => { methodModal.editing ? onEditMethod(m) : onAddMethod(m); setMethodModal({ open: false }); }}
          onClose={() => setMethodModal({ open: false })} />
      )}
      {prepareModal && (
        <PrepareQuickModal method={prepareModal} coffeeName={coffee.name}
          onStart={(steps, title) => { onPrepare(steps, title, prepareModal.grindClicks); setPrepareModal(null); }}
          onClose={() => setPrepareModal(null)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// RECIPE CALCULATOR SECTION
// ─────────────────────────────────────────────

function RecipeCalcSection({ onStartTimer }: { onStartTimer: (steps: RecipeStep[], title: string) => void }) {
  const [method, setMethod] = useState<"v60" | "aeropress">("v60");
  const [v60Recipe, setV60Recipe] = useState<"46" | "standard">("46");
  const [water, setWater] = useState(300);
  const [ratio, setRatio] = useState(15);
  const [aeropressRecipe, setAeropressRecipe] = useState<AeropressRecipe>("america");
  const [aeropressDoble, setAeropressDoble] = useState(false);

  const isAeropress = method === "aeropress";

  const coffeeg = isAeropress
    ? (aeropressRecipe === "expres" && aeropressDoble ? 30 : AEROPRESS_COFFEE[aeropressRecipe])
    : v60Recipe === "standard"
    ? (water / 16).toFixed(1)
    : (water / ratio).toFixed(1);

  const aeropressMark = aeropressRecipe === "expres" && aeropressDoble ? 2 : AEROPRESS_MARK[aeropressRecipe];

  const steps = isAeropress
    ? buildAeropressStepsForRecipe(aeropressRecipe, aeropressDoble)
    : v60Recipe === "standard"
    ? buildV60StandardSteps(water)
    : buildV60Steps(water, ratio);

  const timerTitle = isAeropress
    ? `Aeropress ${AEROPRESS_LABELS[aeropressRecipe]}${aeropressRecipe === "expres" && aeropressDoble ? " Doble" : ""}`
    : v60Recipe === "standard"
    ? `V60 Estàndard · ${water} ml`
    : `V60 4:6 · ${water} ml`;

  const recipeTitle = isAeropress
    ? `Aeropress · ${AEROPRESS_LABELS[aeropressRecipe]}${aeropressRecipe === "expres" && aeropressDoble ? " Doble" : ""}`
    : v60Recipe === "standard"
    ? "V60 · Mètode Estàndard (2 Abocaments)"
    : "V60 · Mètode 4:6 (Tetsu Kasuya)";

  const recipeDescription = isAeropress
    ? AEROPRESS_TEMP[aeropressRecipe] + (aeropressMark ? ` · Marca ${aeropressMark} al tub` : "")
    : v60Recipe === "standard"
    ? "Pre-infusió + 2 abocaments principals · Ràtio fixe 1:16"
    : "5 abocats iguals (20% cada un) cada 45 segons";

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-700 flex items-center justify-center"><Scale className="w-5 h-5 text-white" /></div>
          <div>
            <h2 className="font-bold text-stone-800 text-lg">Calculadora de receptes</h2>
            <p className="text-xs text-stone-400">Proporcions i passos automàtics</p>
          </div>
        </div>

        {/* Method selector */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {(["v60", "aeropress"] as const).map((m) => (
            <button key={m} onClick={() => setMethod(m)}
              className={`py-3.5 rounded-xl text-sm font-bold transition-all ${method === m ? "bg-amber-800 text-white shadow-sm" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}>
              {m === "v60" ? "☕ V60" : "🔵 Aeropress"}
            </button>
          ))}
        </div>

        {/* V60 sub-selector */}
        {method === "v60" && (
          <div className="flex rounded-xl border border-stone-200 overflow-hidden mb-5">
            {(["46", "standard"] as const).map((r) => (
              <button key={r} onClick={() => setV60Recipe(r)}
                className={`flex-1 py-2.5 text-xs font-bold transition-colors ${v60Recipe === r ? "bg-amber-50 text-amber-800 border-b-2 border-amber-700" : "text-stone-400 hover:text-stone-600 hover:bg-stone-50"}`}>
                {r === "46" ? "Mètode 4:6 · Kasuya" : "Estàndard · 2 Abocaments"}
              </button>
            ))}
          </div>
        )}

        {/* Aeropress sub-selector */}
        {isAeropress && (
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {(Object.keys(AEROPRESS_LABELS) as AeropressRecipe[]).map((r) => (
              <button key={r} onClick={() => setAeropressRecipe(r)}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${aeropressRecipe === r ? "bg-sky-700 text-white border-sky-700" : "bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-300"}`}>
                {AEROPRESS_LABELS[r]}
              </button>
            ))}
          </div>
        )}

        {/* Exprès individual/doble toggle */}
        {isAeropress && aeropressRecipe === "expres" && (
          <div className="flex rounded-xl border border-stone-200 overflow-hidden mb-5">
            {([false, true] as const).map((d) => (
              <button key={String(d)} onClick={() => setAeropressDoble(d)}
                className={`flex-1 py-2.5 text-xs font-bold transition-colors ${aeropressDoble === d ? "bg-sky-50 text-sky-800 border-b-2 border-sky-700" : "text-stone-400 hover:text-stone-600 hover:bg-stone-50"}`}>
                {d ? "Doble · 30g" : "Individual · 15g"}
              </button>
            ))}
          </div>
        )}

        {/* V60: water & ratio controls */}
        {!isAeropress && (
          <div className="space-y-5 mb-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-stone-700">Volum d'aigua</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" value={water} min={50} max={800} onChange={(e) => setWater(Number(e.target.value))}
                    className="w-16 border border-stone-200 rounded-lg px-2 py-1 text-sm font-bold text-stone-800 text-right focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <span className="text-sm text-stone-400 font-medium">ml</span>
                </div>
              </div>
              <input type="range" min={50} max={800} step={10} value={water} onChange={(e) => setWater(Number(e.target.value))} className="w-full" />
              <div className="flex justify-between text-xs text-stone-300 mt-1"><span>50 ml</span><span>800 ml</span></div>
            </div>
            {v60Recipe === "46" && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-stone-700">Ràtio cafè / aigua</label>
                  <span className="text-sm font-bold text-amber-700">1:{ratio}</span>
                </div>
                <input type="range" min={12} max={20} step={0.5} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} className="w-full" />
                <div className="flex justify-between text-xs text-stone-300 mt-1"><span>1:12 (molt fort)</span><span>1:20 (suau)</span></div>
              </div>
            )}
            {v60Recipe === "standard" && (
              <div className="flex items-center justify-between py-2.5 px-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-sm text-stone-500">Ràtio fixe</span>
                <span className="text-sm font-bold text-amber-700">1:16</span>
              </div>
            )}
          </div>
        )}

        {/* Summary card */}
        {isAeropress ? (
          <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-2xl p-5 border border-sky-100 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-sky-500 font-bold mb-1">Cafè mòlt</p>
              <p className="text-4xl font-extrabold text-sky-900 tabular-nums">{coffeeg}</p>
              <p className="text-sm text-sky-600 font-medium mt-0.5">grams</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-sky-500 font-bold mb-1">Marca tub</p>
              <p className="text-4xl font-extrabold text-sky-900 tabular-nums">{aeropressMark}</p>
              <p className="text-sm text-sky-600 font-medium mt-0.5">al tub</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-sky-500 font-bold mb-1">Temperatura</p>
              <p className="text-lg font-extrabold text-sky-900 leading-tight mt-2">{AEROPRESS_TEMP[aeropressRecipe]}</p>
            </div>
          </div>
        ) : (
          <div className="mt-5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100">
            <div className="flex justify-around items-center">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-amber-500 font-bold mb-1">Cafè mòlt</p>
                <p className="text-5xl font-extrabold text-amber-900 tabular-nums">{coffeeg}</p>
                <p className="text-sm text-amber-600 font-medium mt-0.5">grams</p>
              </div>
              <div className="text-amber-200 text-3xl font-thin">·</div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-amber-500 font-bold mb-1">Aigua</p>
                <p className="text-5xl font-extrabold text-amber-900 tabular-nums">{water}</p>
                <p className="text-sm text-amber-600 font-medium mt-0.5">ml / g</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <h3 className="font-bold text-stone-700 mb-1">{recipeTitle}</h3>
        <p className="text-xs text-stone-400 mb-4">{recipeDescription}</p>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className={`flex-shrink-0 text-xs font-mono font-bold px-2 py-1 rounded-lg mt-0.5 ${step.isAlert ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-400"}`}>
                {fmtTime(step.time)}
              </span>
              <div className="flex-1">
                <p className="text-sm text-stone-600 leading-snug">{step.instruction}</p>
                {step.amount && (
                  <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                    <Droplets className="w-3 h-3" /> {step.amount.toFixed(0)} g
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => onStartTimer(steps, timerTitle)}
          className="mt-5 w-full flex items-center justify-center gap-3 bg-amber-800 text-white rounded-2xl py-4 font-bold text-base hover:bg-amber-900 transition-colors shadow-lg shadow-amber-800/20">
          <Clock className="w-5 h-5" /> Preparar amb temporitzador
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PREPARATION TIMER MODAL
// ─────────────────────────────────────────────

function PreparationTimerModal({ steps, title, grindClicks, onApplyGrind, onClose }: {
  steps: RecipeStep[]; title: string;
  grindClicks?: number; onApplyGrind?: (clicks: number) => void;
  onClose: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const prevStepIdx = useRef(-1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const stepIdx = steps.reduce((a, s, i) => (elapsed >= s.time ? i : a), 0);
  const curStep = steps[stepIdx];
  const nxtStep = steps[stepIdx + 1] as RecipeStep | undefined;
  const timeToNext = nxtStep ? nxtStep.time - elapsed : null;
  const segProgress = nxtStep ? Math.min(100, ((elapsed - curStep.time) / (nxtStep.time - curStep.time)) * 100) : 100;

  const beep = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioRef.current;
      const now = ctx.currentTime;
      [880, 1100].forEach((hz, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = hz;
        gain.gain.setValueAtTime(0, now + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.4);
        osc.start(now + i * 0.18); osc.stop(now + i * 0.18 + 0.4);
      });
    } catch { /* Audio API not available */ }
  }, []);

  useEffect(() => {
    if (stepIdx !== prevStepIdx.current && running && prevStepIdx.current >= 0) beep();
    prevStepIdx.current = stepIdx;
  }, [stepIdx, running, beep]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((t) => {
          const next = t + 1;
          if (next > steps[steps.length - 1].time + 30) { setDone(true); setRunning(false); }
          return next;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, steps]);

  const reset = () => { setElapsed(0); setRunning(false); setDone(false); prevStepIdx.current = -1; };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950 select-none">
      <div className="flex items-center justify-between px-4 pt-8 pb-3">
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        <p className="text-amber-400 text-sm font-semibold text-center max-w-[200px] truncate">{title}</p>
        <button onClick={reset} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"><RotateCcw className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-5">
        <div className="text-center">
          <div className={`text-8xl font-mono font-black tracking-tighter tabular-nums transition-colors ${done ? "text-green-400" : running ? "text-white" : "text-white/50"}`}>
            {fmtTime(elapsed)}
          </div>
          {timeToNext !== null && !done && (
            <p className="text-white/30 text-sm mt-2">
              Proper pas en <span className="text-amber-400 font-bold">{fmtTime(timeToNext)}</span>
            </p>
          )}
        </div>

        {!done && nxtStep && (
          <div className="w-full max-w-xs">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${segProgress}%` }} />
            </div>
          </div>
        )}

        {!done ? (
          <div className={`w-full max-w-sm rounded-2xl p-5 transition-colors ${curStep?.isAlert ? "bg-amber-600" : "bg-white/10"}`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {curStep?.isAlert ? <AlertCircle className="w-6 h-6 text-white" /> : <Clock className="w-6 h-6 text-white/40" />}
              </div>
              <p className="text-white font-semibold text-base leading-snug">{curStep?.instruction}</p>
            </div>
            {curStep?.amount && (
              <div className="mt-3 flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-2 w-fit">
                <Droplets className="w-4 h-4 text-sky-200" />
                <span className="text-white font-bold text-sm">{curStep.amount.toFixed(0)} g</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-sm rounded-2xl bg-green-700 p-7 text-center text-white">
            <CheckCircle className="w-14 h-14 mx-auto mb-3" />
            <p className="text-2xl font-extrabold">Cafè llest!</p>
            <p className="text-green-200 text-sm mt-1.5">Que ho gaudeixis molt! ☕</p>
            {grindClicks !== undefined && onApplyGrind && (
              <button
                onClick={() => onApplyGrind(grindClicks)}
                className="mt-5 w-full bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Aplicar aquesta molta al molinet
              </button>
            )}
          </div>
        )}

        {!done && steps.slice(stepIdx + 1).length > 0 && (
          <div className="w-full max-w-sm bg-white/5 rounded-2xl p-4 space-y-2.5 max-h-32 overflow-y-auto">
            <p className="text-[10px] uppercase tracking-widest text-white/25 font-bold mb-1">Pròxims passos</p>
            {steps.slice(stepIdx + 1).map((s, i) => (
              <div key={i} className="flex gap-2.5 items-start opacity-50">
                <span className="text-xs font-mono text-amber-400 flex-shrink-0 w-9">{fmtTime(s.time)}</span>
                <p className="text-xs text-white leading-snug line-clamp-2">{s.instruction}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 pb-10 pt-4">
        <button onClick={() => setRunning((r) => !r)} disabled={done}
          className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 font-extrabold text-xl transition-all ${done ? "bg-white/5 text-white/20 cursor-not-allowed" : running ? "bg-white/15 text-white hover:bg-white/25" : "bg-amber-600 text-white hover:bg-amber-500 shadow-2xl shadow-amber-900/60"}`}>
          {running ? <><Pause className="w-7 h-7" /> Pausar</> : <><Play className="w-7 h-7" /> {elapsed === 0 ? "Iniciar" : "Continuar"}</>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "coffees" as const, Icon: Coffee, label: "Cafès" },
  { id: "recipe" as const, Icon: Scale, label: "Receptes" },
  { id: "settings" as const, Icon: Settings, label: "Molinet" },
];

export default function BeanRecipeApp() {
  // ── Auth ──
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Data ──
  const [tab, setTab] = useState<"coffees" | "recipe" | "settings">("coffees");
  const [coffees, setCoffees] = useState<CoffeeBean[]>([]);
  const [grinder, setGrinder] = useState<GrinderConfig>({ calibrationOffset: 0, currentClick: 0, clicksPerRotation: DEFAULT_CLICKS_PER_ROTATION });
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coffeeModal, setCoffeeModal] = useState<{ open: boolean; editing?: CoffeeBean }>({ open: false });
  const [timer, setTimer] = useState<{ steps: RecipeStep[]; title: string; grindClicks?: number } | null>(null);

  // ── Auth listener ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load data when user changes ──
  useEffect(() => {
    if (!user) {
      setCoffees([]);
      setGrinder({ calibrationOffset: 0, currentClick: 0, clicksPerRotation: DEFAULT_CLICKS_PER_ROTATION });
      return;
    }
    setDataLoading(true);
    Promise.all([dbFetchCoffees(user.id), dbFetchGrinderConfig(user.id)])
      .then(([fetchedCoffees, fetchedGrinder]) => {
        setCoffees(fetchedCoffees);
        if (fetchedGrinder) setGrinder(fetchedGrinder);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [user?.id]);

  // ── Coffee CRUD ──
  const upsertCoffee = async (c: CoffeeBean) => {
    setCoffees((prev) => prev.some((x) => x.id === c.id) ? prev.map((x) => x.id === c.id ? c : x) : [...prev, c]);
    setCoffeeModal({ open: false });
    await dbUpsertCoffee(c, user!.id).catch(console.error);
  };

  const deleteCoffee = async (id: string) => {
    setCoffees((prev) => prev.filter((c) => c.id !== id));
    setSelectedId(null);
    await dbDeleteCoffee(id).catch(console.error);
  };

  const addMethod = async (coffeeId: string, m: BrewMethod) => {
    setCoffees((prev) => prev.map((c) => c.id === coffeeId ? { ...c, methods: [...c.methods, m] } : c));
    await dbUpsertMethod(m, coffeeId, user!.id).catch(console.error);
  };

  const editMethod = async (coffeeId: string, m: BrewMethod) => {
    setCoffees((prev) => prev.map((c) => c.id === coffeeId ? { ...c, methods: c.methods.map((x) => x.id === m.id ? m : x) } : c));
    await dbUpsertMethod(m, coffeeId, user!.id).catch(console.error);
  };

  const deleteMethod = async (coffeeId: string, mId: string) => {
    setCoffees((prev) => prev.map((c) => c.id === coffeeId ? { ...c, methods: c.methods.filter((x) => x.id !== mId) } : c));
    await dbDeleteMethod(mId).catch(console.error);
  };

  const handleSaveGrinder = async (cfg: GrinderConfig) => {
    setGrinder(cfg);
    await dbSaveGrinderConfig(cfg, user!.id).catch(console.error);
  };

  const handleApplyGrind = async (clicks: number) => {
    const updated = { ...grinder, currentClick: clicks };
    setGrinder(updated);
    await dbSaveGrinderConfig(updated, user!.id).catch(console.error);
  };

  const handleLogout = () => supabase.auth.signOut();

  // ── Derived ──
  const selectedCoffee = coffees.find((c) => c.id === selectedId);

  // ── Render: loading auth ──
  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-amber-900 rounded-2xl flex items-center justify-center">
            <Coffee className="w-6 h-6 text-amber-100" />
          </div>
          <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // ── Render: not logged in ──
  if (!user) return <AuthForm />;

  // ── Render: loading data ──
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <div className="w-8 h-8 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">Carregant les teves dades...</p>
        </div>
      </div>
    );
  }

  // ── Render: main app ──
  return (
    <div className="min-h-screen bg-stone-100 flex flex-col max-w-xl mx-auto shadow-xl">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-amber-900 px-4 py-3.5 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-800 rounded-xl flex items-center justify-center shadow-inner">
              <Coffee className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h1 className="font-black text-white text-xl leading-none tracking-tight">BeanRecipe</h1>
              <p className="text-amber-300/80 text-xs mt-0.5 truncate max-w-[160px]">{user.email}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-white px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors font-medium">
            <LogOut className="w-3.5 h-3.5" /> Sortir
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24 px-3 py-4 space-y-4">
        {tab === "coffees" && (
          <>
            <div className="flex items-center justify-between px-1">
              <h2 className="font-bold text-stone-700 text-lg">Els meus cafès</h2>
              <button onClick={() => setCoffeeModal({ open: true })}
                className="flex items-center gap-1.5 bg-amber-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-900 transition-colors shadow-sm">
                <Plus className="w-4 h-4" /> Nou cafè
              </button>
            </div>
            {coffees.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 flex flex-col items-center py-16 px-8 text-center">
                <Coffee className="w-16 h-16 text-stone-200 mb-5" />
                <p className="font-bold text-stone-400 text-lg">Sense cafès registrats</p>
                <p className="text-stone-400 text-sm mt-2 max-w-xs leading-relaxed">Afegeix el teu primer cafè i comença a guardar els teus graus de moltura i receptes preferides.</p>
                <button onClick={() => setCoffeeModal({ open: true })} className="mt-7 bg-amber-800 text-white px-7 py-3 rounded-xl font-bold text-sm hover:bg-amber-900 shadow-md">
                  Afegir primer cafè
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {coffees.map((coffee) => (
                  <button key={coffee.id} onClick={() => setSelectedId(coffee.id)}
                    className="w-full bg-white rounded-2xl border border-stone-200 px-4 py-4 text-left hover:border-amber-300 hover:shadow-sm active:scale-[0.985] transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-stone-800 truncate">{coffee.name}</p>
                        <p className="text-sm text-stone-400 mt-0.5 truncate">{[coffee.roaster, coffee.origin].filter(Boolean).join(" · ")}</p>
                        {coffee.roastDate && <p className="text-xs text-stone-300 mt-1">Torrat: {coffee.roastDate}</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        {coffee.methods.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                            {coffee.methods.map((m) => (
                              <span key={m.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${METHOD_BADGE[m.type]}`}>
                                {METHOD_LABEL[m.type]}
                              </span>
                            ))}
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-stone-300 flex-shrink-0" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "recipe" && <RecipeCalcSection onStartTimer={(steps, title) => setTimer({ steps, title })} />}
        {tab === "settings" && <GrinderSection cfg={grinder} onSave={handleSaveGrinder} />}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-20 max-w-xl mx-auto bg-white border-t border-stone-200 flex shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
        {NAV_ITEMS.map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3.5 transition-colors ${tab === id ? "text-amber-800" : "text-stone-400 hover:text-stone-600"}`}>
            <Icon className="w-5 h-5" strokeWidth={tab === id ? 2.5 : 1.75} />
            <span className="text-[11px] font-semibold">{label}</span>
          </button>
        ))}
      </nav>

      {/* Modals */}
      {coffeeModal.open && (
        <CoffeeFormModal coffee={coffeeModal.editing} onSave={upsertCoffee} onClose={() => setCoffeeModal({ open: false })} />
      )}
      {selectedCoffee && (
        <CoffeeDetailPanel coffee={selectedCoffee} grinderCfg={grinder}
          onClose={() => setSelectedId(null)}
          onEditCoffee={() => { setCoffeeModal({ open: true, editing: selectedCoffee }); setSelectedId(null); }}
          onDeleteCoffee={() => deleteCoffee(selectedCoffee.id)}
          onAddMethod={(m) => addMethod(selectedCoffee.id, m)}
          onEditMethod={(m) => editMethod(selectedCoffee.id, m)}
          onDeleteMethod={(id) => deleteMethod(selectedCoffee.id, id)}
          onPrepare={(steps, title, grindClicks) => { setTimer({ steps, title, grindClicks }); setSelectedId(null); }}
          onApplyGrind={handleApplyGrind} />
      )}
      {timer && (
        <PreparationTimerModal
          steps={timer.steps}
          title={timer.title}
          grindClicks={timer.grindClicks}
          onApplyGrind={handleApplyGrind}
          onClose={() => setTimer(null)}
        />
      )}
    </div>
  );
}
