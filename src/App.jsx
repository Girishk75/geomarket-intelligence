import { useState, useEffect } from "react";

// ─── Agent Definitions ────────────────────────────────────────────────────────

const AGENTS = [
  { id: "orchestrator", label: "Orchestrator", icon: "◈", color: "#a78bfa", desc: "Reads event · Plans the mission" },
  { id: "geopolitical", label: "Geopolitical", icon: "🌐", color: "#38bdf8", desc: "Context · History · Escalation risk" },
  { id: "macro",        label: "Macro",        icon: "📊", color: "#f59e0b", desc: "INR · FII · RBI · Trade flows" },
  { id: "sector",       label: "Sector",       icon: "🏭", color: "#10b981", desc: "Deep-dive on targeted sectors" },
  { id: "stockpicker",  label: "Stock Picker", icon: "🎯", color: "#f97316", desc: "NSE picks with conviction scores" },
  { id: "technical",    label: "Technical",    icon: "📈", color: "#06b6d4", desc: "Live prices · MAs · Price targets" },
  { id: "risk",         label: "Risk Agent",   icon: "⚠", color: "#ef4444",  desc: "Devil's advocate · Bear case" },
  { id: "veteran",      label: "The Veteran",  icon: "⚑", color: "#92400e",  desc: "25yr expert · Validates all agents" },
  { id: "synthesis",    label: "Synthesis",    icon: "✦", color: "#e879f9",  desc: "Final intelligence report" },
];

const FALLBACK_EVENTS = [
  "India-Pakistan military tensions escalate at LoC",
  "US Fed signals aggressive rate cuts in 2025",
  "China imposes rare earth export restrictions",
  "Iran blocks Strait of Hormuz shipping routes",
  "India signs landmark free trade agreement with EU",
  "Russia-Ukraine ceasefire negotiations begin",
  "Global semiconductor supply chain disruption",
  "RBI unexpectedly cuts repo rate by 50bps",
];

// ─── Live Events Fetcher ──────────────────────────────────────────────────────

async function fetchLiveEvents() {
  const messages = [{ role: "user", content: "Search for today's top 6-8 geopolitical and macroeconomic events that could impact Indian stock markets (NSE/BSE). Include India-specific events, global macro developments, and geopolitical tensions. Return ONLY a JSON array of short event strings, each under 90 characters. Example format: [\"event one\", \"event two\"]. No markdown, no explanation." }];

  for (let turn = 0; turn < 6; turn++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: "You are a financial news curator. Search the web for today's live geopolitical and macro events affecting Indian markets. Respond ONLY with a valid JSON array of 6-8 short event strings. No markdown, no preamble, no explanation. Just the JSON array.",
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages,
      }),
    });
    if (!res.ok) throw new Error("Events fetch failed");
    const data = await res.json();

    // Collect any text
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    if (text) {
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        try { return JSON.parse(match[0]); } catch (_) {}
      }
    }

    if (data.stop_reason === "end_turn") break;

    if (data.stop_reason === "tool_use") {
      const toolUse = (data.content || []).filter(b => b.type === "tool_use");
      if (!toolUse.length) break;
      messages.push({ role: "assistant", content: data.content });
      messages.push({ role: "user", content: toolUse.map(b => ({ type: "tool_result", tool_use_id: b.id, content: [] })) });
      continue;
    }
    break;
  }
  throw new Error("Could not parse events");
}

// ─── Agent Prompts ─────────────────────────────────────────────────────────────

function orchestratorPrompt(event) {
  return {
    system: `You are the Orchestrator of a financial intelligence system focused on Indian equity markets.
Respond ONLY with valid JSON. No markdown, no preamble.
JSON format:
{
  "event_type": "GEOPOLITICAL|MACRO|POLICY|TRADE|CONFLICT|NATURAL",
  "event_summary": "2 sentence plain English summary",
  "urgency": "HIGH|MEDIUM|LOW",
  "focus_sectors": ["sector1","sector2","sector3","sector4"],
  "macro_themes": ["theme1","theme2","theme3"],
  "geopolitical_category": "CONFLICT|SANCTIONS|DIPLOMACY|TRADE_WAR|DOMESTIC|OTHER",
  "india_direct_exposure": "HIGH|MEDIUM|LOW",
  "mission_brief": "1 sentence instruction to the analyst team"
}
Available sectors: Defence & Aerospace, Pharma & Healthcare, IT & Tech, Energy & Oil, Banking & NBFC, Metals & Mining, FMCG, Infra & Real Estate, Auto & EV, Agri & Chemicals, Telecom, Renewables, Gold & Commodities
CRITICAL: Return ONLY a valid JSON object. No markdown. No extra text. Keep all string values under 120 characters. Never use double-quote characters inside string values.`,
    user: `Event to analyze: "${event}"`
  };
}

function geopoliticalPrompt(event, orchestration) {
  return {
    system: `You are a Geopolitical Intelligence Analyst specializing in events affecting India.
Respond ONLY with valid JSON. No markdown, no preamble.
JSON format:
{
  "context": "3-4 sentence deep context of the event",
  "historical_parallel": "Most relevant historical parallel and what happened to markets then",
  "escalation_probability": "HIGH|MEDIUM|LOW",
  "escalation_path": "1-2 sentences on how this could escalate",
  "india_direct_impact": "Specific ways India is directly exposed",
  "india_indirect_impact": "Second-order effects on India",
  "timeline_estimate": "SHORT (days)|MEDIUM (weeks)|LONG (months+)",
  "resolution_scenarios": [
    {"scenario": "Base case", "probability": 60, "market_implication": "..."},
    {"scenario": "Bull case", "probability": 25, "market_implication": "..."},
    {"scenario": "Bear case", "probability": 15, "market_implication": "..."}
  ]
}
CRITICAL: Return ONLY a valid JSON object. No markdown. No extra text. Keep all string values under 120 characters. Never use double-quote characters inside string values.`,
    user: `Event: "${event}"\nOrchestrator plan: ${JSON.stringify(orchestration)}\n\nProvide geopolitical intelligence.`
  };
}

function macroPrompt(event, orchestration, geopolitical) {
  return {
    system: `You are a Macro Economist specializing in Indian markets (BSE/NSE), RBI policy, and global capital flows.
Respond ONLY with valid JSON. No markdown, no preamble.
JSON format:
{
  "macro_signal": "RISK-ON|RISK-OFF|MIXED",
  "signal_strength": "STRONG|MODERATE|WEAK",
  "inr_outlook": {"direction": "DEPRECIATION|APPRECIATION|STABLE", "magnitude": "1-2%|3-5%|5%+", "reasoning": "..."},
  "fii_flow_expectation": "OUTFLOW|INFLOW|NEUTRAL",
  "fii_impact_sectors": ["sector1","sector2"],
  "inflation_impact": "UP|DOWN|NEUTRAL",
  "rbi_likely_response": "RATE_CUT|RATE_HIKE|HOLD|INTERVENTION",
  "crude_oil_impact": "UP|DOWN|NEUTRAL",
  "gold_impact": "UP|DOWN|NEUTRAL",
  "trade_balance_effect": "WIDEN|NARROW|NEUTRAL",
  "key_macro_insight": "1 high-conviction insight a retail investor would miss"
}
CRITICAL: Return ONLY a valid JSON object. No markdown. No extra text. Keep all string values under 120 characters. Never use double-quote characters inside string values.`,
    user: `Event: "${event}"\nGeopolitical analysis: ${JSON.stringify(geopolitical)}\n\nProvide macro analysis for Indian markets.`
  };
}

function sectorPrompt(event, orchestration, geopolitical, macro) {
  return {
    system: `You are a Sector Specialist for Indian equity markets. You analyze ONLY the sectors assigned to you.
Respond ONLY with valid JSON. No markdown, no preamble.
JSON format:
{
  "sectors": [
    {
      "name": "Sector name",
      "impact": "BULLISH|BEARISH|NEUTRAL",
      "impact_score": 5,
      "conviction": "HIGH|MEDIUM|LOW",
      "thesis": "2-3 sentence investment thesis",
      "key_drivers": ["driver1","driver2","driver3"],
      "timeframe": "SHORT|MEDIUM|LONG",
      "companies": [
        {
          "name": "Company Name (NSE: TICKER)",
          "impact": "BULLISH|BEARISH|NEUTRAL",
          "conviction_score": 8,
          "reason": "Specific reason this company is affected",
          "market_cap": "LARGE|MID|SMALL"
        }
      ]
    }
  ]
}
Include exactly 2 companies per sector. Max 3 sectors total. Focus only on NSE-listed Indian companies. Be concise.
CRITICAL: Return ONLY a valid JSON object. No markdown. No extra text. Keep all string values under 120 characters. Never use double-quote characters inside string values.`,
    user: `Event: "${event}"
Focus sectors: ${orchestration.focus_sectors?.join(", ")}
Macro signal: ${macro.macro_signal} (${macro.signal_strength})
INR: ${macro.inr_outlook?.direction}, FII: ${macro.fii_flow_expectation}
Geopolitical context: ${geopolitical.context}

Analyze each focus sector in depth.`
  };
}

function stockPickerPrompt(event, orchestration, geopolitical, macro, sectors) {
  return {
    system: `You are an elite Stock Picker for Indian equity markets. You synthesize intelligence from multiple agents to identify highest-conviction trades.
Respond ONLY with valid JSON. No markdown, no preamble.
JSON format:
{
  "top_picks": [
    {
      "company": "Full Company Name",
      "ticker": "NSE_TICKER",
      "action": "BUY|SELL|WATCH",
      "conviction": 8,
      "thesis": "2 sentence investment thesis",
      "catalyst": "Specific near-term catalyst",
      "risk": "Main risk to this call",
      "holding_period": "e.g. 1-2 weeks, 3-6 weeks, 2-3 months, 6-12 months",
      "sector": "Sector name"
    }
  ],
  "avoid_list": [
    {"company": "Name (TICKER)", "reason": "Why to avoid"}
  ],
  "theme_play": "1 sentence on the overarching trade theme",
  "index_outlook": "NIFTY50 outlook in 1 sentence"
}
Provide 4-6 top picks and 2-3 stocks to avoid.
CRITICAL: Return ONLY a valid JSON object. No markdown. No extra text. Keep all string values under 120 characters. Never use double-quote characters inside string values.`,
    user: `Event: "${event}"
Macro: ${macro.macro_signal}, INR ${macro.inr_outlook?.direction}, FII ${macro.fii_flow_expectation}
Sectors: ${sectors.sectors?.map(s => s.name + "(" + s.impact + " " + s.impact_score + "): " + s.companies?.map(c => c.name).join(", ")).join(" | ")}

Identify highest conviction stock picks.`
  };
}

function riskPrompt(event, orchestration, geopolitical, macro, sectors, stocks) {
  return {
    system: `You are the Risk & Devil's Advocate Agent. Your job is to stress-test the analysis and find what everyone else missed.
Respond ONLY with valid JSON. No markdown, no preamble.
JSON format:
{
  "risk_flags": [
    {
      "title": "Risk title",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "probability": "HIGH|MEDIUM|LOW",
      "description": "1-2 sentence description",
      "affected_picks": ["TICKER1","TICKER2"]
    }
  ],
  "bear_case": "2-3 sentence worst case scenario for Indian markets",
  "contrarian_view": "1 unconventional take that goes against consensus",
  "black_swan": "1 low-probability high-impact scenario to be aware of",
  "overall_risk_rating": "HIGH|MEDIUM|LOW"
}
Be brutally honest. Poke holes in the bullish thesis.
CRITICAL: Return ONLY a valid JSON object. No markdown. No extra text. Keep all string values under 120 characters. Never use double-quote characters inside string values.`,
    user: `Event: "${event}"
Analysis so far — Macro: ${macro.macro_signal}, Geopolitical escalation: ${geopolitical.escalation_probability}
Top picks: ${stocks.top_picks?.map(p => p.ticker).join(", ")}
Key themes: ${orchestration.macro_themes?.join(", ")}

What is everyone missing? What could go badly wrong?`
  };
}


function veteranPrompt(event, geo, macro, sectors, stocks, risks, tech) {
  const picksStr = stocks.top_picks?.map(p => p.ticker + "(" + p.action + " conviction:" + p.fundamental_score + "/" + p.sentiment_score + ")").join(", ") || "";
  const techStr  = tech?.stocks?.map(t => t.ticker + ":tech=" + t.technical_score + " " + t.trend).join(", ") || "N/A";
  return {
    system: `You are THE VETERAN — a fiercely independent Indian market expert with 25+ years of experience.
You have traded through the 1991 liberalisation, 1997 Asian crisis, Kargil 1999, 2001 dotcom crash, 2008 global crash, 2013 taper tantrum, 2016 demonetisation, COVID crash of 2020, and every major geopolitical shock since.
You have zero tolerance for consensus thinking and always ask: what is the market MISSING?
You read every agent report and give a blunt, experienced verdict on whether the analysis is sound.
Respond ONLY with valid JSON. No markdown. No preamble. Keep all strings under 120 characters. No double-quotes inside strings.
JSON format:
{
  "overall_verdict": "APPROVED|CHALLENGED|MIXED",
  "verdict_stamp": "1 punchy sentence — your bottom line on the whole analysis",
  "overrides": [
    {
      "ticker": "TICKER",
      "original_action": "BUY|SELL|WATCH",
      "revised_action": "BUY|SELL|WATCH|HOLD",
      "reason": "Blunt 1-sentence reason based on experience"
    }
  ],
  "missed_picks": [
    {
      "ticker": "NSE_TICKER",
      "company": "Company name",
      "action": "BUY|SELL|WATCH",
      "conviction": 8,
      "reason": "Why agents missed this and why it matters"
    }
  ],
  "conviction_adjustments": [
    {
      "ticker": "TICKER",
      "original": 6,
      "revised": 9,
      "direction": "UP|DOWN",
      "reason": "Experience-based reason for adjustment"
    }
  ],
  "timing_correction": "Were the agents right on timing? If not, what does history say?",
  "contrarian_call": "The one thing the ENTIRE system got wrong that an experienced eye catches",
  "sector_disagreement": "Which sector call do you disagree with most and why?",
  "final_verdict": "2-3 sentence personal bottom line. Blunt. No hedging. What would YOU do?"
}
CRITICAL: Return ONLY valid JSON. Keep all string values under 120 characters.`,
    user: `Validate this complete market analysis for event: "${event}"

GEOPOLITICAL: escalation=${geo.escalation_probability}, timeline=${geo.timeline_estimate}
MACRO: signal=${macro.macro_signal} ${macro.signal_strength}, INR=${macro.inr_outlook?.direction}, FII=${macro.fii_flow_expectation}, RBI=${macro.rbi_likely_response}
SECTORS: ${sectors.sectors?.map(s => s.name + "(" + s.impact + " " + s.impact_score + ")").join(", ")}
STOCK PICKS: ${picksStr}
TECHNICAL: ${techStr}
RISK RATING: ${risks.overall_risk_rating}
BEAR CASE: ${risks.bear_case}
CONTRARIAN (risk agent): ${risks.contrarian_view}

Validate, challenge, and improve this analysis with your 25 years of experience.`
  };
}

function synthesisPrompt(event, orchestration, geopolitical, macro, sectors, stocks, risks, tech, veteran) {
  return {
    system: `You are the Chief Intelligence Synthesizer. Combine all agent reports into a final actionable brief.
Respond ONLY with valid JSON. No markdown, no preamble.
JSON format:
{
  "headline": "8-10 word punchy headline summarizing the market implication",
  "executive_summary": "3-4 sentence synthesis a busy investor can act on",
  "macro_signal": "RISK-ON|RISK-OFF|MIXED",
  "signal_strength": "STRONG|MODERATE|WEAK",
  "india_angle": "How this specifically plays out in Indian markets",
  "time_horizon": "SHORT (days)|MEDIUM (weeks)|LONG (months)",
  "top_sectors": [
    {"name": "...", "impact": "BULLISH|BEARISH|NEUTRAL", "score": 5}
  ],
  "final_picks": [
    {"ticker": "...", "company": "...", "action": "BUY|SELL|WATCH", "conviction": 8, "one_liner": "...", "holding_period": "e.g. 3-6 weeks", "bear_pct": -10, "base_pct": 18, "bull_pct": 32}
  ],
  "key_risks": ["risk1","risk2","risk3"],
  "contrarian_take": "...",
  "watchlist": ["TICKER1","TICKER2","TICKER3","TICKER4","TICKER5"]
}
CRITICAL: Return ONLY a valid JSON object. No markdown. No extra text. Keep all string values under 120 characters. Never use double-quote characters inside string values.`,
    user: `Synthesize all intelligence for event: "${event}"
Geopolitical: ${geopolitical.context}
Macro signal: ${macro.macro_signal} | INR: ${macro.inr_outlook?.direction} | FII: ${macro.fii_flow_expectation}
Sectors: ${sectors.sectors?.map(s => s.name + "(" + (s.impact_score > 0 ? "+" : "") + s.impact_score + ")").join(", ")}
Top picks: ${stocks.top_picks?.slice(0, 4).map(p => p.ticker + "(" + p.action + ")").join(", ")}
Technical signals: ${tech?.stocks?.map(t => t.ticker + ": " + t.technical_signal + " score=" + t.technical_score + " trend=" + t.trend).join(" | ") || "N/A"}
Overall risk: ${risks.overall_risk_rating} | Bear case: ${risks.bear_case}
Contrarian: ${risks.contrarian_view}
Veteran verdict: ${veteran?.overall_verdict} — ${veteran?.verdict_stamp}
Veteran overrides: ${veteran?.overrides?.map(o => o.ticker + " " + o.original_action + "->" + o.revised_action).join(", ") || "none"}
Veteran missed picks: ${veteran?.missed_picks?.map(m => m.ticker + "(" + m.action + ")").join(", ") || "none"}
Veteran final: ${veteran?.final_verdict}
For each final pick, incorporate veteran overrides and provide realistic bear_pct, base_pct, bull_pct price targets as integers.`
  };
}


// ─── Yahoo Finance + Technical Agent ─────────────────────────────────────────

async function fetchYahooData(tickers) {
  const results = [];
  for (const ticker of tickers) {
    try {
      const sym = ticker.replace(/\.NS$/i, "") + ".NS";
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1y`;
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) { results.push({ ticker: sym, error: "proxy_error" }); continue; }
      const outer = await res.json();
      const inner = JSON.parse(outer.contents);
      if (!inner?.chart?.result?.[0]) { results.push({ ticker: sym, error: "no_data" }); continue; }
      const r = inner.chart.result[0];
      const meta = r.meta;
      const closes = (r.indicators?.quote?.[0]?.close || []).filter(Boolean);
      const volumes = (r.indicators?.quote?.[0]?.volume || []).filter(Boolean);
      const price = meta.regularMarketPrice;
      const high52 = meta.fiftyTwoWeekHigh;
      const low52 = meta.fiftyTwoWeekLow;
      const prevClose = meta.chartPreviousClose || meta.previousClose;
      const change1d = prevClose ? +((price - prevClose) / prevClose * 100).toFixed(2) : null;
      const ma50 = closes.length >= 50 ? +(closes.slice(-50).reduce((a,b) => a+b,0) / 50).toFixed(2) : null;
      const ma200 = closes.length >= 150 ? +(closes.slice(-Math.min(200,closes.length)).reduce((a,b) => a+b,0) / Math.min(200,closes.length)).toFixed(2) : null;
      const avgVol20 = volumes.length >= 10 ? volumes.slice(-20).reduce((a,b) => a+b,0) / Math.min(20,volumes.length) : null;
      const volRatio = avgVol20 ? +((meta.regularMarketVolume || 0) / avgVol20).toFixed(2) : null;
      const rangePos = high52 && low52 && high52 !== low52 ? +((price - low52) / (high52 - low52) * 100).toFixed(0) : null;
      results.push({
        ticker: sym, price: price?.toFixed(2), change1d,
        high52: high52?.toFixed(2), low52: low52?.toFixed(2),
        ma50, ma200, rangePos, volRatio,
        aboveMa50: ma50 ? price > ma50 : null,
        aboveMa200: ma200 ? price > ma200 : null,
        goldenCross: (ma50 && ma200) ? ma50 > ma200 : null,
        currency: meta.currency || "INR",
      });
    } catch(e) {
      results.push({ ticker, error: e.message });
    }
  }
  return results;
}

function technicalPrompt(event, geo, macro, stocks, techData) {
  return {
    system: `You are a Senior Technical Analyst for Indian equity markets. You receive live Yahoo Finance price data and interpret technical signals in context of a geopolitical event.
Respond ONLY with valid JSON. No markdown, no preamble.
JSON format:
{
  "stocks": [
    {
      "ticker": "NSE_TICKER.NS",
      "technical_signal": "BULLISH|BEARISH|NEUTRAL",
      "technical_score": 7,
      "trend": "UPTREND|DOWNTREND|MIXED",
      "momentum": "STRONG|MODERATE|WEAK",
      "key_support": 0.00,
      "key_resistance": 0.00,
      "range_comment": "e.g. Near 52W high, momentum intact",
      "volume_comment": "e.g. Above average volume confirms breakout",
      "bear_pct": -12,
      "base_pct": 18,
      "bull_pct": 30,
      "technical_note": "1 sentence key technical observation"
    }
  ],
  "overall_market_technical": "BULLISH|BEARISH|NEUTRAL",
  "technical_summary": "1-2 sentence overall technical picture for Indian markets"
}
CRITICAL: Return ONLY valid JSON. No markdown. Keep strings under 100 chars. No double-quotes inside string values.`,
    user: `Geopolitical event: "${event}"
Macro: ${macro.macro_signal}, Geo risk: ${geo.escalation_probability}
Stock picks from previous agent: ${stocks.top_picks?.map(p => p.ticker + "(" + p.action + " cv=" + p.conviction + ")").join(", ")}

Live Yahoo Finance data:
${JSON.stringify(techData, null, 1)}

For each stock: interpret technical signals (MA crossovers, range position, volume) in context of this geopolitical event. Set support near recent MA or 52W low, resistance near 52W high. Price targets as % from current price over the holding period.`
  };
}

// ─── API Call Helper ───────────────────────────────────────────────────────────

function repairJSON(raw) {
  // Remove trailing commas before } or ]
  let s = raw.replace(/,(\s*[}\]])/g, "$1");
  // String-aware bracket tracking
  const stack = [];
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i], p = i > 0 ? s[i - 1] : "";
    if (c === '"' && p !== "\\") inStr = !inStr;
    if (!inStr) {
      if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if ((c === "}" || c === "]") && stack.length) stack.pop();
    }
  }
  if (inStr) s += '"';
  return s + stack.reverse().join("");
}

async function callAgent(prompt) {
  const apiKey = localStorage.getItem("anthropic_api_key") || "";
  if (!apiKey) throw new Error("No API key set. Click ⚙ Settings to add your Anthropic API key.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    }),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();

  const rawText = (data.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("");

  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in response");

  let jsonStr = match[0];
  try {
    return JSON.parse(jsonStr);
  } catch (_) {
    try {
      return JSON.parse(repairJSON(jsonStr));
    } catch (e2) {
      throw new Error("JSON parse failed: " + e2.message);
    }
  }
}

// ─── E-Paper UI ──────────────────────────────────────────────────────────────

const C = {
  bg:      "#F2EDE2",
  paper:   "#FDFCF8",
  rule:    "#C4B89A",
  rule2:   "#DDD5C0",
  ink:     "#1A1510",
  ink2:    "#3D332A",
  ink3:    "#6B5A4A",
  ink4:    "#9C8A78",
  bull:    "#1B4D1E",
  bear:    "#8B1A1A",
  neutral: "#5A4E3A",
};

const bull = i => i === "BULLISH" ? C.bull : i === "BEARISH" ? C.bear : C.neutral;
const actC = a => a === "BUY" ? C.bull : a === "SELL" ? C.bear : C.neutral;

function Stamp({ text, color }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 2,
      color: color || C.ink2,
      border: `1px solid ${color || C.ink2}`,
      padding: "2px 6px",
      fontFamily: "'IBM Plex Mono', monospace",
      whiteSpace: "nowrap",
      textTransform: "uppercase",
    }}>{text}</span>
  );
}

function Rule({ style }) {
  return <div style={{ height: 1, background: C.rule, ...style }} />;
}

function Section({ label, children, accent }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 10
      }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 3,
          color: accent || C.ink3, fontFamily: "'IBM Plex Mono', monospace",
          textTransform: "uppercase"
        }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: C.rule2 }} />
      </div>
      {children}
    </div>
  );
}

function ScoreBar({ score }) {
  const pct = ((score + 10) / 20) * 100;
  const color = score > 0 ? C.bull : score < 0 ? C.bear : C.neutral;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 3, background: C.rule2, position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: 3, background: C.rule }} />
        <div style={{
          position: "absolute",
          left: score >= 0 ? "50%" : `${pct}%`,
          width: `${(Math.abs(score) / 20) * 100}%`,
          height: 3, background: color,
        }} />
      </div>
      <span style={{ fontSize: 9, color, fontFamily: "'IBM Plex Mono', monospace", minWidth: 24 }}>
        {score > 0 ? "+" : ""}{score}
      </span>
    </div>
  );
}

function ConvictionPips({ score, max = 10 }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 6, height: 6,
          background: i < score ? C.ink2 : C.rule2,
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        }} />
      ))}
      <span style={{ fontSize: 9, color: C.ink3, marginLeft: 6, fontFamily: "'IBM Plex Mono', monospace" }}>{score}/10</span>
    </div>
  );
}

function AgentRow({ agent, status, duration }) {
  const isActive  = status === "running";
  const isDone    = status === "done";
  const isError   = status === "error";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "7px 0",
      borderBottom: `1px solid ${C.rule2}`,
      opacity: status === "idle" ? 0.35 : 1,
      transition: "opacity 0.3s"
    }}>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
        color: isError ? C.bear : isDone ? C.bull : isActive ? C.ink2 : C.ink4,
        animation: isActive ? "blink 1s step-end infinite" : "none",
        minWidth: 14, textAlign: "center"
      }}>
        {isError ? "✕" : isDone ? "✓" : isActive ? "▶" : "○"}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? C.ink : isDone ? C.ink2 : C.ink3, fontFamily: "'IBM Plex Mono', monospace", flex: 1 }}>
        {agent.label}
      </span>
      <span style={{ fontSize: 9, color: C.ink4, fontFamily: "'IBM Plex Mono', monospace" }}>
        {agent.desc}
      </span>
      {duration && <span style={{ fontSize: 9, color: C.ink4, fontFamily: "'IBM Plex Mono', monospace", marginLeft: 8 }}>{duration}s</span>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GeoMarketMultiAgent() {
  const [query, setQuery] = useState("");
  const [agentStatus, setAgentStatus] = useState({});
  const [agentData, setAgentData] = useState({});
  const [agentDuration, setAgentDuration] = useState({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [expandedAgent, setExpandedAgent] = useState(null);
  const [liveEvents, setLiveEvents] = useState(FALLBACK_EVENTS);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsTimestamp, setEventsTimestamp] = useState(null);
  const [eventsError, setEventsError] = useState(false);

  async function refreshEvents() {
    setEventsLoading(true);
    setEventsError(false);
    try {
      const events = await fetchLiveEvents();
      if (Array.isArray(events) && events.length > 0) {
        setLiveEvents(events.slice(0, 8));
        setEventsTimestamp(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch (_) {
      setEventsError(true);
    } finally {
      setEventsLoading(false);
    }
  }

  // Auto-fetch live events on mount
  useEffect(() => { refreshEvents(); }, []);

  const result = agentData.synthesis;

  function setStatus(id, s) {
    setAgentStatus(p => ({ ...p, [id]: s }));
  }

  async function runAgent(id, promptFn, ...args) {
    setStatus(id, "running");
    const t0 = Date.now();
    try {
      const data = await callAgent(promptFn(...args));
      setAgentData(p => ({ ...p, [id]: data }));
      setAgentDuration(p => ({ ...p, [id]: ((Date.now() - t0) / 1000).toFixed(1) }));
      setStatus(id, "done");
      return data;
    } catch (e) {
      setStatus(id, "error");
      throw e;
    }
  }

  async function runAnalysis() {
    if (!query.trim() || running) return;
    setRunning(true);
    setError(null);
    setAgentStatus({});
    setAgentData({});
    setAgentDuration({});
    setActiveTab("summary");
    try {
      const orch  = await runAgent("orchestrator", orchestratorPrompt, query);
      const geo   = await runAgent("geopolitical",  geopoliticalPrompt, query, orch);
      const macro = await runAgent("macro",          macroPrompt,        query, orch, geo);
      const sects = await runAgent("sector",         sectorPrompt,       query, orch, geo, macro);
      const picks = await runAgent("stockpicker",    stockPickerPrompt,  query, orch, geo, macro, sects);
      const tickers = picks.top_picks?.map(p => p.ticker).filter(Boolean) || [];
      setStatus("technical", "running");
      const t0tech = Date.now();
      const techData = await fetchYahooData(tickers);
      setAgentData(p => ({ ...p, yahooRaw: techData }));
      setAgentDuration(p => ({ ...p, technical: ((Date.now() - t0tech) / 1000).toFixed(1) }));
      const tech  = await runAgent("technical",     technicalPrompt,    query, geo, macro, picks, techData);
      const risks   = await runAgent("risk",     riskPrompt,     query, orch, geo, macro, sects, picks);
      const veteran = await runAgent("veteran",  veteranPrompt,  query, geo, macro, sects, picks, risks, tech);
      await runAgent("synthesis", synthesisPrompt, query, orch, geo, macro, sects, picks, risks, tech, veteran);
      setActiveTab("summary");
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const tabs = result ? [
    { id: "summary", label: "Summary"  },
    { id: "picks",   label: "Picks"    },
    { id: "sectors", label: "Sectors"  },
    { id: "geo",     label: "Geo Intel"},
    { id: "macro",   label: "Macro"    },
    { id: "risks",   label: "Risks"    },
    { id: "veteran",  label: "⚑ Veteran" },
    { id: "technical", label: "Technical" },
    { id: "raw",       label: "Agents"   },
  ] : [];

  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem("anthropic_api_key") || "");

  function saveApiKey() {
    localStorage.setItem("anthropic_api_key", apiKeyInput.trim());
    setShowSettings(false);
    if (apiKeyInput.trim()) refreshEvents();
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Georgia, 'Times New Roman', serif", color: C.ink, paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        textarea::placeholder { color: ${C.rule}; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
        textarea { font-family: 'IBM Plex Mono', monospace !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.rule}; }
        button { font-family: 'IBM Plex Mono', monospace; cursor: pointer; }

        /* ── Responsive ── */
        .masthead-title { font-size: 30px; }
        .main-pad { padding: 24px 20px 0; }
        .sig-strip  { grid-template-columns: repeat(5, 1fr); }
        .grid-4     { grid-template-columns: repeat(4, 1fr); }
        .grid-2     { grid-template-columns: 1fr 1fr; }
        .grid-2-macro { grid-template-columns: 1fr 1fr; }
        .tab-bar    { overflow-x: auto; -webkit-overflow-scrolling: touch; white-space: nowrap; }
        .picks-targets { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
        .india-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        @media (max-width: 640px) {
          .masthead-title { font-size: 20px !important; }
          .main-pad { padding: 16px 12px 0 !important; }
          .sig-strip  { grid-template-columns: repeat(3, 1fr) !important; }
          .grid-4     { grid-template-columns: 1fr 1fr !important; }
          .grid-2     { grid-template-columns: 1fr !important; }
          .grid-2-macro { grid-template-columns: 1fr 1fr !important; }
          .india-grid { grid-template-columns: 1fr !important; }
          .preset-bar { display: none; }
          .hide-mobile { display: none !important; }
        }
      `}</style>

      {/* Masthead */}
      <div style={{ borderBottom: `3px solid ${C.ink}` }}>
        <div style={{ borderBottom: `1px solid ${C.ink}`, padding: "4px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2, color: C.ink3 }}>7-AGENT INTELLIGENCE SYSTEM</span>
            <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2, color: C.ink3 }}>NSE · BSE · INDIA MARKETS</span>
          </div>
        </div>
        <div style={{ padding: "10px 16px 8px", textAlign: "center" }}>
          <h1 className="masthead-title" style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 900, margin: 0, letterSpacing: -0.5,
            color: C.ink, lineHeight: 1.1
          }}>
            GeoMarket Intelligence
          </h1>
          <p className="hide-mobile" style={{ margin: "4px 0 0", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.ink3, letterSpacing: 1 }}>
            Geopolitical Events → Market Impact → Stock Signals
          </p>
        </div>
      </div>

      <div className="main-pad" style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Input */}
        <div style={{ border: `1px solid ${C.rule}`, background: C.paper, marginBottom: 12 }}>
          <div style={{ padding: "5px 14px", borderBottom: `1px solid ${C.rule2}`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2.5, color: C.ink3 }}>EVENT INPUT</span>
            <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.rule }}>PRESS ENTER TO ANALYSE</span>
          </div>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runAnalysis(); } }}
            placeholder="Enter geopolitical event, news headline, or macro development..."
            rows={2}
            style={{
              width: "100%", background: "transparent", border: "none", outline: "none",
              color: C.ink, fontSize: 14, padding: "14px 16px",
              resize: "none", lineHeight: 1.7,
            }}
          />
        </div>

        {/* Live Events */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
            <span style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2.5, color: C.ink3 }}>
              TODAY'S EVENTS
            </span>
            {eventsTimestamp && !eventsError && (
              <span style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", color: C.bull }}>
                ● LIVE · {eventsTimestamp}
              </span>
            )}
            {eventsError && (
              <span style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", color: C.ink4 }}>
                ○ FALLBACK
              </span>
            )}
            <button
              onClick={refreshEvents}
              disabled={eventsLoading}
              style={{
                marginLeft: "auto", background: "transparent",
                border: `1px solid ${C.rule}`, color: C.ink3,
                fontSize: 9, padding: "2px 10px", cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace",
                opacity: eventsLoading ? 0.5 : 1,
              }}
            >
              {eventsLoading ? "FETCHING..." : "↻ REFRESH"}
            </button>
          </div>
          <div className="preset-bar" style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {liveEvents.map((p, i) => (
              <button key={i} onClick={() => setQuery(p)} style={{
                background: "transparent", border: `1px solid ${C.rule}`,
                color: C.ink3, fontSize: 9, padding: "3px 10px",
                letterSpacing: 0.3, transition: "all 0.1s",
                fontFamily: "'IBM Plex Mono', monospace",
                textAlign: "left",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = C.ink; e.currentTarget.style.color = C.bg; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.ink3; }}
              >{p}</button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button onClick={runAnalysis} disabled={running || !query.trim()} style={{
          width: "100%", padding: "12px",
          background: running ? C.paper : C.ink,
          border: `1px solid ${C.ink}`,
          color: running ? C.ink : C.bg,
          fontSize: 11, fontWeight: 700, letterSpacing: 4,
          marginBottom: 24, transition: "all 0.2s",
        }}>
          {running ? "▶  AGENTS RUNNING — PLEASE WAIT..." : "LAUNCH 7-AGENT ANALYSIS"}
        </button>

        {/* Agent pipeline */}
        {Object.keys(agentStatus).length > 0 && (
          <div style={{ border: `1px solid ${C.rule}`, background: C.paper, padding: "14px 18px", marginBottom: 24, animation: "fadeUp 0.3s ease" }}>
            <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3, marginBottom: 8 }}>AGENT PIPELINE</div>
            {AGENTS.map(a => (
              <AgentRow key={a.id} agent={a} status={agentStatus[a.id] || "idle"} duration={agentDuration[a.id]} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ border: `1px solid ${C.bear}`, background: C.paper, padding: "12px 16px", color: C.bear, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 20 }}>
            ⚠  {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>

            {/* Headline banner */}
            <div style={{ borderTop: `3px double ${C.ink}`, borderBottom: `3px double ${C.ink}`, padding: "16px 0", marginBottom: 20, textAlign: "center" }}>
              <h2 style={{
                fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900,
                margin: "0 0 8px", color: C.ink, lineHeight: 1.25
              }}>{result.headline}</h2>
              <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                <Stamp text={`${result.macro_signal} · ${result.signal_strength}`}
                  color={result.macro_signal === "RISK-ON" ? C.bull : result.macro_signal === "RISK-OFF" ? C.bear : C.neutral} />
                <Stamp text={result.time_horizon} />
                <Stamp text={`RISK: ${agentData.risk?.overall_risk_rating}`}
                  color={agentData.risk?.overall_risk_rating === "HIGH" ? C.bear : agentData.risk?.overall_risk_rating === "LOW" ? C.bull : C.neutral} />
              </div>
            </div>

            {/* Tab navigation - newspaper section style */}
            <div className="tab-bar" style={{ display: "flex", borderBottom: `2px solid ${C.ink}`, marginBottom: 20 }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  background: activeTab === t.id ? C.ink : "transparent",
                  border: "none",
                  borderRight: `1px solid ${C.rule}`,
                  color: activeTab === t.id ? C.bg : C.ink3,
                  padding: "7px 16px", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                  whiteSpace: "nowrap", transition: "all 0.15s",
                }}>{t.label.toUpperCase()}</button>
              ))}
            </div>

            {/* ── SUMMARY ── */}
            {activeTab === "summary" && (
              <div>

                {/* Veteran Verdict Banner */}
                {agentData.veteran && (
                  <div style={{
                    background: agentData.veteran.overall_verdict === "APPROVED" ? "#f0f7f0" : agentData.veteran.overall_verdict === "CHALLENGED" ? "#fdf2f2" : "#fdf8f0",
                    border: `1px solid ${agentData.veteran.overall_verdict === "APPROVED" ? C.bull : agentData.veteran.overall_verdict === "CHALLENGED" ? C.bear : C.neutral}`,
                    borderLeft: `4px solid ${agentData.veteran.overall_verdict === "APPROVED" ? C.bull : agentData.veteran.overall_verdict === "CHALLENGED" ? C.bear : C.neutral}`,
                    padding: "12px 16px", marginBottom: 14
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: C.ink }}>⚑  THE VETERAN</span>
                      <Stamp
                        text={agentData.veteran.overall_verdict}
                        color={agentData.veteran.overall_verdict === "APPROVED" ? C.bull : agentData.veteran.overall_verdict === "CHALLENGED" ? C.bear : C.neutral}
                      />
                      {agentData.veteran.overrides?.length > 0 && <Stamp text={`${agentData.veteran.overrides.length} OVERRIDE${agentData.veteran.overrides.length > 1 ? "S" : ""}`} color={C.bear} />}
                      {agentData.veteran.missed_picks?.length > 0 && <Stamp text={`${agentData.veteran.missed_picks.length} MISSED`} color={C.neutral} />}
                    </div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: C.ink, fontStyle: "italic" }}>"{agentData.veteran.verdict_stamp}"</p>
                    <p style={{ margin: 0, fontSize: 11, color: C.ink2, lineHeight: 1.65 }}>{agentData.veteran.final_verdict}</p>
                  </div>
                )}

                {/* Signal strip */}
                <div className="sig-strip" style={{ display: "grid", border: `1px solid ${C.rule}`, background: C.paper, marginBottom: 14 }}>
                  {[
                    { label: "SIGNAL", value: result.macro_signal, color: result.macro_signal === "RISK-ON" ? C.bull : result.macro_signal === "RISK-OFF" ? C.bear : C.neutral },
                    { label: "HORIZON", value: result.time_horizon, color: C.ink2 },
                    { label: "INR", value: `${agentData.macro?.inr_outlook?.direction || ""} ${agentData.macro?.inr_outlook?.magnitude || ""}`.trim(), color: agentData.macro?.inr_outlook?.direction === "APPRECIATION" ? C.bull : C.bear },
                    { label: "FII FLOWS", value: agentData.macro?.fii_flow_expectation, color: agentData.macro?.fii_flow_expectation === "INFLOW" ? C.bull : agentData.macro?.fii_flow_expectation === "OUTFLOW" ? C.bear : C.neutral },
                    { label: "OVERALL RISK", value: agentData.risk?.overall_risk_rating, color: agentData.risk?.overall_risk_rating === "HIGH" ? C.bear : agentData.risk?.overall_risk_rating === "LOW" ? C.bull : C.neutral },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderRight: i < 4 ? `1px solid ${C.rule2}` : "none", textAlign: "center" }}>
                      <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2, color: C.ink4, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: item.color, fontFamily: "'IBM Plex Mono', monospace" }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Top picks */}
                {result.final_picks?.length > 0 && (
                  <div style={{ background: C.paper, border: `1px solid ${C.rule}`, marginBottom: 14 }}>
                    <div style={{ padding: "7px 14px", borderBottom: `1px solid ${C.rule}`, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3 }}>ACT NOW — TOP PICKS</span>
                      <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.ink4 }}>CONVICTION  HORIZON</span>
                    </div>
                    {result.final_picks.map((p, i) => {
                      const live = agentData.yahooRaw?.find(t => t.ticker === p.ticker + ".NS" || t.ticker === p.ticker);
                      const lp = live && !live.error ? parseFloat(live.price) : null;
                      const chg = live && !live.error ? live.change1d : null;
                      return (
                        <div key={i} style={{ padding: "9px 14px", borderBottom: i < result.final_picks.length - 1 ? `1px solid ${C.rule2}` : "none", borderLeft: `3px solid ${actC(p.action)}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: C.ink, minWidth: 70 }}>{p.ticker}</span>
                            <Stamp text={p.action} color={actC(p.action)} />
                            {lp ? (
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 700, color: C.ink }}>
                                ₹{lp.toFixed(2)}
                                {chg != null && <span style={{ fontSize: 10, color: chg >= 0 ? C.bull : C.bear, marginLeft: 5 }}>{chg >= 0 ? "▲" : "▼"}{Math.abs(chg)}%</span>}
                              </span>
                            ) : (
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.ink4 }}>LIVE N/A</span>
                            )}
                            <span style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.ink2, background: C.bg, padding: "2px 8px", border: `1px solid ${C.rule}` }}>
                              ⏱ {p.holding_period || result.time_horizon}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: C.ink2 }}>{p.one_liner}</span>
                          {(p.bear_pct != null || p.base_pct != null) && (
                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                              {lp && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.bear, border: `1px solid ${C.bear}30`, padding: "2px 7px" }}>BEAR ₹{(lp*(1+p.bear_pct/100)).toFixed(0)} ({p.bear_pct}%)</span>}
                              {lp && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.ink2, border: `1px solid ${C.rule}`, padding: "2px 7px" }}>BASE ₹{(lp*(1+p.base_pct/100)).toFixed(0)} (+{p.base_pct}%)</span>}
                              {lp && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.bull, border: `1px solid ${C.bull}30`, padding: "2px 7px" }}>BULL ₹{(lp*(1+p.bull_pct/100)).toFixed(0)} (+{p.bull_pct}%)</span>}
                              {!lp && <><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.bear, border: `1px solid ${C.bear}30`, padding: "2px 7px" }}>BEAR {p.bear_pct}%</span>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.ink2, border: `1px solid ${C.rule}`, padding: "2px 7px" }}>BASE +{p.base_pct}%</span>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.bull, border: `1px solid ${C.bull}30`, padding: "2px 7px" }}>BULL +{p.bull_pct}%</span></>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Sectors grid */}
                {result.top_sectors?.length > 0 && (
                  <div style={{ background: C.paper, border: `1px solid ${C.rule}`, marginBottom: 14 }}>
                    <div style={{ padding: "7px 14px", borderBottom: `1px solid ${C.rule}` }}>
                      <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3 }}>SECTORS AT A GLANCE</span>
                    </div>
                    <div className="grid-2" style={{ display: "grid" }}>
                      {result.top_sectors.map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRight: i % 2 === 0 ? `1px solid ${C.rule2}` : "none", borderBottom: i < result.top_sectors.length - 2 ? `1px solid ${C.rule2}` : "none" }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: bull(s.impact) }}>{s.impact === "BULLISH" ? "▲" : s.impact === "BEARISH" ? "▼" : "—"}</span>
                          <span style={{ fontSize: 11, color: C.ink, flex: 1 }}>{s.name}</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: bull(s.impact), minWidth: 28 }}>{s.score > 0 ? "+" : ""}{s.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key risks */}
                {result.key_risks?.length > 0 && (
                  <div style={{ background: C.paper, border: `1px solid ${C.rule}`, marginBottom: 14 }}>
                    <div style={{ padding: "7px 14px", borderBottom: `1px solid ${C.rule}` }}>
                      <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.bear }}>WATCH OUT FOR</span>
                    </div>
                    {result.key_risks.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, padding: "8px 14px", borderBottom: i < result.key_risks.length - 1 ? `1px solid ${C.rule2}` : "none" }}>
                        <span style={{ color: C.bear, fontSize: 10, marginTop: 2 }}>◆</span>
                        <span style={{ fontSize: 12, color: C.ink2, lineHeight: 1.5 }}>{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* India angle + contrarian side by side */}
                <div className="india-grid" style={{ display: "grid", gap: 10 }}>
                  <div style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: "12px 14px", borderLeft: `3px solid ${C.ink2}` }}>
                    <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2.5, color: C.ink3, marginBottom: 6 }}>🇮🇳 INDIA ANGLE</div>
                    <p style={{ margin: 0, fontSize: 11, color: C.ink2, lineHeight: 1.65 }}>{result.india_angle}</p>
                  </div>
                  <div style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: "12px 14px", borderLeft: `3px solid ${C.ink4}` }}>
                    <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2.5, color: C.ink3, marginBottom: 6 }}>CONTRARIAN VIEW</div>
                    <p style={{ margin: 0, fontSize: 11, color: C.ink2, lineHeight: 1.65, fontStyle: "italic" }}>{result.contrarian_take}</p>
                  </div>
                </div>

              </div>
            )}


            {/* ── PICKS ── */}
            {activeTab === "picks" && (
              <div>
                {agentData.stockpicker?.theme_play && (
                  <p style={{ fontSize: 13, color: C.ink2, fontStyle: "italic", marginBottom: 16, padding: "0 4px", lineHeight: 1.7, borderLeft: `3px solid ${C.rule}`, paddingLeft: 14 }}>
                    {agentData.stockpicker.theme_play}
                  </p>
                )}
                {result.final_picks?.map((p, i) => (
                  <div key={i} style={{ background: C.paper, border: `1px solid ${C.rule}`, borderLeft: `4px solid ${actC(p.action)}`, marginBottom: 12 }}>
                    {/* Header */}
                    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.rule2}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 700, color: C.ink }}>{p.ticker}</span>
                        <span style={{ fontSize: 11, color: C.ink3 }}>{p.company}</span>
                        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                          <Stamp text={p.action} color={actC(p.action)} />
                          {(() => { const td = agentData.technical?.stocks?.find(t => t.ticker === p.ticker + ".NS" || t.ticker === p.ticker); return td ? <Stamp text={td.technical_signal} color={td.technical_signal === "BULLISH" ? C.bull : td.technical_signal === "BEARISH" ? C.bear : C.neutral} /> : null; })()}
                        </div>
                      </div>
                      <div style={{ marginBottom: 6 }}><ConvictionPips score={p.conviction} /></div>
                      <p style={{ margin: 0, fontSize: 12, color: C.ink2, lineHeight: 1.7 }}>{p.one_liner}</p>
                    </div>
                    {/* Live price + targets */}
                    {(() => {
                      const td = agentData.technical?.stocks?.find(t => t.ticker === p.ticker + ".NS" || t.ticker === p.ticker);
                      const lp = td?.price ? parseFloat(td.price) : null;
                      return (
                        <div style={{ padding: "10px 16px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, border: `1px solid ${C.rule2}`, marginBottom: 8 }}>
                            {[
                              { label: "LIVE PRICE", value: lp ? "₹" + lp.toFixed(2) : "—", color: C.ink },
                              { label: "BEAR CASE", value: (p.bear_pct != null && lp) ? "₹" + (lp * (1 + p.bear_pct/100)).toFixed(2) + " (" + (p.bear_pct > 0 ? "+" : "") + p.bear_pct + "%)" : (p.bear_pct != null ? (p.bear_pct > 0 ? "+" : "") + p.bear_pct + "%" : "—"), color: C.bear },
                              { label: "BASE CASE", value: (p.base_pct != null && lp) ? "₹" + (lp * (1 + p.base_pct/100)).toFixed(2) + " (+" + p.base_pct + "%)" : (p.base_pct != null ? "+" + p.base_pct + "%" : "—"), color: C.ink2 },
                              { label: "BULL CASE", value: (p.bull_pct != null && lp) ? "₹" + (lp * (1 + p.bull_pct/100)).toFixed(2) + " (+" + p.bull_pct + "%)" : (p.bull_pct != null ? "+" + p.bull_pct + "%" : "—"), color: C.bull },
                            ].map((cell, ci) => (
                              <div key={ci} style={{ padding: "8px 10px", borderRight: ci < 3 ? `1px solid ${C.rule2}` : "none", textAlign: "center" }}>
                                <div style={{ fontSize: 7, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1.5, color: C.ink4, marginBottom: 4 }}>{cell.label}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: cell.color, fontFamily: "'IBM Plex Mono', monospace" }}>{cell.value}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.ink2, background: C.bg, padding: "2px 8px", border: `1px solid ${C.rule}` }}>⏱ {p.holding_period || result.time_horizon}</span>
                            {td && !td.error && <>
                              {td.rangePos != null && <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.ink4 }}>52W range: {td.rangePos}%</span>}
                              {td.ma50 && <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: td.aboveMa50 ? C.bull : C.bear }}>MA50: ₹{td.ma50} {td.aboveMa50 ? "▲" : "▼"}</span>}
                              {td.volRatio && <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: td.volRatio > 1.5 ? C.bull : C.ink4 }}>Vol: {td.volRatio}x avg</span>}
                            </>}
                            {td?.error && <span style={{ fontSize: 9, color: C.bear, fontFamily: "'IBM Plex Mono', monospace" }}>Live data unavailable</span>}
                          </div>
                          {td?.technical_note && <p style={{ margin: "6px 0 0", fontSize: 11, color: C.ink3, fontStyle: "italic" }}>"{td.technical_note}"</p>}
                        </div>
                      );
                    })()}
                  </div>
                ))}

                {agentData.stockpicker?.avoid_list?.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.bear, marginBottom: 8 }}>AVOID</div>
                    {agentData.stockpicker.avoid_list.map((a, i) => (
                      <div key={i} style={{ background: C.paper, border: `1px solid ${C.rule}`, borderLeft: `4px solid ${C.bear}`, padding: "10px 14px", marginBottom: 6, display: "flex", gap: 12 }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: C.bear }}>{a.company}</span>
                        <span style={{ fontSize: 11, color: C.ink3 }}>{a.reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 16, padding: "12px 16px", background: C.paper, border: `1px solid ${C.rule}` }}>
                  <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3, marginBottom: 10 }}>WATCHLIST</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {result.watchlist?.map((t, i) => (
                      <span key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 700, color: C.bull, border: `1px solid ${C.bull}`, padding: "3px 12px" }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── SECTORS ── */}
            {activeTab === "sectors" && agentData.sector?.sectors && (
              <div>
                {agentData.sector.sectors.map((s, i) => (
                  <div key={i} style={{ background: C.paper, border: `1px solid ${C.rule}`, borderLeft: `4px solid ${bull(s.impact)}`, marginBottom: 14 }}>
                    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.rule2}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{s.name}</span>
                        <Stamp text={s.impact} color={bull(s.impact)} />
                        <Stamp text={`CONVICTION: ${s.conviction}`} />
                        <div style={{ marginLeft: "auto", width: 80 }}><ScoreBar score={s.impact_score} /></div>
                      </div>
                      <p style={{ margin: "0 0 8px", fontSize: 12, color: C.ink2, lineHeight: 1.7 }}>{s.thesis}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {s.key_drivers?.map((d, j) => (
                          <span key={j} style={{ fontSize: 9, color: C.ink3, padding: "2px 8px", border: `1px solid ${C.rule2}`, fontFamily: "'IBM Plex Mono', monospace" }}>{d}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      {s.companies?.map((c, j) => (
                        <div key={j} style={{ display: "flex", gap: 12, padding: "10px 16px", borderBottom: j < s.companies.length - 1 ? `1px solid ${C.rule2}` : "none" }}>
                          <span style={{ color: bull(c.impact), fontSize: 10, marginTop: 2, minWidth: 10 }}>{c.impact === "BULLISH" ? "▲" : c.impact === "BEARISH" ? "▼" : "—"}</span>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: C.ink }}>{c.name}</span>
                              <Stamp text={c.market_cap} />
                              <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.ink3, marginLeft: "auto" }}>{c.conviction_score}/10</span>
                            </div>
                            <p style={{ margin: 0, fontSize: 11, color: C.ink3, lineHeight: 1.6 }}>{c.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── GEO INTEL ── */}
            {activeTab === "geo" && agentData.geopolitical && (
              <div>
                {[
                  { label: "CONTEXT",              value: agentData.geopolitical.context },
                  { label: "HISTORICAL PARALLEL",  value: agentData.geopolitical.historical_parallel },
                  { label: "INDIA — DIRECT IMPACT", value: agentData.geopolitical.india_direct_impact },
                  { label: "INDIA — INDIRECT IMPACT", value: agentData.geopolitical.india_indirect_impact },
                  { label: "ESCALATION PATH",      value: agentData.geopolitical.escalation_path },
                ].map(item => (
                  <div key={item.label} style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: "14px 18px", marginBottom: 10 }}>
                    <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3, marginBottom: 8 }}>{item.label}</div>
                    <p style={{ margin: 0, fontSize: 13, color: C.ink2, lineHeight: 1.8 }}>{item.value}</p>
                  </div>
                ))}
                {agentData.geopolitical.resolution_scenarios && (
                  <div style={{ background: C.paper, border: `1px solid ${C.rule}`, overflow: "hidden" }}>
                    <div style={{ padding: "8px 16px", borderBottom: `1px solid ${C.rule}` }}>
                      <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3 }}>RESOLUTION SCENARIOS</span>
                    </div>
                    {agentData.geopolitical.resolution_scenarios.map((sc, i) => (
                      <div key={i} style={{ padding: "12px 16px", borderBottom: i < 2 ? `1px solid ${C.rule2}` : "none", borderLeft: `4px solid ${i === 0 ? C.neutral : i === 1 ? C.bull : C.bear}` }}>
                        <div style={{ display: "flex", gap: 10, marginBottom: 4, alignItems: "center" }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: C.ink }}>{sc.scenario}</span>
                          <Stamp text={`${sc.probability}%`} />
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: C.ink3, lineHeight: 1.6 }}>{sc.market_implication}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── MACRO ── */}
            {activeTab === "macro" && agentData.macro && (
              <div>
                <div className="grid-2-macro" style={{ display: "grid", gap: 0, border: `1px solid ${C.rule}`, background: C.paper, marginBottom: 14 }}>
                  {[
                    { label: "MACRO SIGNAL",   value: `${agentData.macro.macro_signal} · ${agentData.macro.signal_strength}`, color: agentData.macro.macro_signal === "RISK-ON" ? C.bull : C.bear },
                    { label: "INR OUTLOOK",    value: `${agentData.macro.inr_outlook?.direction} (${agentData.macro.inr_outlook?.magnitude})`, color: C.ink2 },
                    { label: "FII FLOW",       value: agentData.macro.fii_flow_expectation, color: agentData.macro.fii_flow_expectation === "INFLOW" ? C.bull : C.bear },
                    { label: "INFLATION",      value: agentData.macro.inflation_impact, color: agentData.macro.inflation_impact === "UP" ? C.bear : C.bull },
                    { label: "RBI RESPONSE",   value: agentData.macro.rbi_likely_response?.replace(/_/g," "), color: C.ink2 },
                    { label: "CRUDE OIL",      value: agentData.macro.crude_oil_impact, color: agentData.macro.crude_oil_impact === "UP" ? C.bear : C.bull },
                    { label: "GOLD",           value: agentData.macro.gold_impact, color: agentData.macro.gold_impact === "UP" ? C.bull : C.neutral },
                    { label: "TRADE BALANCE",  value: agentData.macro.trade_balance_effect, color: agentData.macro.trade_balance_effect === "WIDEN" ? C.bear : C.bull },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: "12px 14px", borderRight: i % 2 === 0 ? `1px solid ${C.rule2}` : "none", borderBottom: i < 6 ? `1px solid ${C.rule2}` : "none" }}>
                      <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2, color: C.ink4, marginBottom: 5 }}>{item.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: item.color, fontFamily: "'IBM Plex Mono', monospace" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: "14px 18px", borderLeft: `4px solid ${C.ink}`, marginBottom: 10 }}>
                  <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3, marginBottom: 8 }}>WHAT RETAIL INVESTORS MISS</div>
                  <p style={{ margin: 0, fontSize: 13, color: C.ink, lineHeight: 1.8 }}>{agentData.macro.key_macro_insight}</p>
                </div>
                <div style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: "14px 18px" }}>
                  <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3, marginBottom: 8 }}>INR REASONING</div>
                  <p style={{ margin: 0, fontSize: 13, color: C.ink2, lineHeight: 1.8 }}>{agentData.macro.inr_outlook?.reasoning}</p>
                </div>
              </div>
            )}

            {/* ── RISKS ── */}
            {activeTab === "risks" && agentData.risk && (
              <div>
                {agentData.risk.risk_flags?.map((r, i) => (
                  <div key={i} style={{ background: C.paper, border: `1px solid ${C.rule}`, borderLeft: `4px solid ${r.severity === "CRITICAL" || r.severity === "HIGH" ? C.bear : C.neutral}`, padding: "12px 16px", marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{r.title}</span>
                      <Stamp text={r.severity} color={r.severity === "CRITICAL" || r.severity === "HIGH" ? C.bear : C.neutral} />
                      <Stamp text={`PROB: ${r.probability}`} />
                      {r.affected_picks?.length > 0 && <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.bear }}>{r.affected_picks.join(", ")}</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: C.ink2, lineHeight: 1.7 }}>{r.description}</p>
                  </div>
                ))}
                <div style={{ background: C.paper, border: `1px solid ${C.rule}`, borderLeft: `4px solid ${C.bear}`, padding: "14px 18px", marginBottom: 10 }}>
                  <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.bear, marginBottom: 8 }}>BEAR CASE</div>
                  <p style={{ margin: 0, fontSize: 13, color: C.ink2, lineHeight: 1.8 }}>{agentData.risk.bear_case}</p>
                </div>
                <div style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: "14px 18px" }}>
                  <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3, marginBottom: 8 }}>BLACK SWAN SCENARIO</div>
                  <p style={{ margin: 0, fontSize: 13, color: C.ink2, fontStyle: "italic", lineHeight: 1.8 }}>{agentData.risk.black_swan}</p>
                </div>
              </div>
            )}


            {/* ── VETERAN ── */}
            {activeTab === "veteran" && agentData.veteran && (
              <div>

                {/* Header verdict */}
                <div style={{
                  background: agentData.veteran.overall_verdict === "APPROVED" ? "#f0f7f0" : agentData.veteran.overall_verdict === "CHALLENGED" ? "#fdf2f2" : "#fdf8f0",
                  border: `1px solid ${agentData.veteran.overall_verdict === "APPROVED" ? C.bull : agentData.veteran.overall_verdict === "CHALLENGED" ? C.bear : C.neutral}`,
                  padding: "16px 18px", marginBottom: 14
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: C.ink }}>⚑  THE VETERAN — 25 YRS EXPERIENCE</span>
                    <Stamp text={agentData.veteran.overall_verdict}
                      color={agentData.veteran.overall_verdict === "APPROVED" ? C.bull : agentData.veteran.overall_verdict === "CHALLENGED" ? C.bear : C.neutral} />
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, fontStyle: "italic", color: C.ink, lineHeight: 1.5 }}>"{agentData.veteran.verdict_stamp}"</p>
                  <p style={{ margin: 0, fontSize: 12, color: C.ink2, lineHeight: 1.75 }}>{agentData.veteran.final_verdict}</p>
                </div>

                {/* Overrides */}
                {agentData.veteran.overrides?.length > 0 && (
                  <div style={{ background: C.paper, border: `1px solid ${C.rule}`, marginBottom: 12 }}>
                    <div style={{ padding: "7px 14px", borderBottom: `1px solid ${C.rule}`, background: "#fdf2f2" }}>
                      <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.bear }}>⚑  OVERRIDES — VETERAN DISAGREES</span>
                    </div>
                    {agentData.veteran.overrides.map((o, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", borderBottom: i < agentData.veteran.overrides.length - 1 ? `1px solid ${C.rule2}` : "none", borderLeft: `3px solid ${C.bear}` }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: C.ink, minWidth: 70 }}>{o.ticker}</span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 120 }}>
                          <Stamp text={o.original_action} color={actC(o.original_action)} />
                          <span style={{ fontSize: 10, color: C.ink3 }}>→</span>
                          <Stamp text={o.revised_action} color={actC(o.revised_action)} />
                        </div>
                        <span style={{ fontSize: 11, color: C.ink2, flex: 1, lineHeight: 1.6 }}>{o.reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Missed picks */}
                {agentData.veteran.missed_picks?.length > 0 && (
                  <div style={{ background: C.paper, border: `1px solid ${C.rule}`, marginBottom: 12 }}>
                    <div style={{ padding: "7px 14px", borderBottom: `1px solid ${C.rule}` }}>
                      <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.neutral }}>◈  MISSED BY ALL AGENTS</span>
                    </div>
                    {agentData.veteran.missed_picks.map((m, i) => (
                      <div key={i} style={{ padding: "10px 14px", borderBottom: i < agentData.veteran.missed_picks.length - 1 ? `1px solid ${C.rule2}` : "none", borderLeft: `3px solid ${C.neutral}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: C.ink }}>{m.ticker}</span>
                          <span style={{ fontSize: 11, color: C.ink3 }}>{m.company}</span>
                          <Stamp text={m.action} color={actC(m.action)} />
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.ink3, marginLeft: "auto" }}>{m.conviction}/10</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: C.ink2, lineHeight: 1.6 }}>{m.reason}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Conviction adjustments */}
                {agentData.veteran.conviction_adjustments?.length > 0 && (
                  <div style={{ background: C.paper, border: `1px solid ${C.rule}`, marginBottom: 12 }}>
                    <div style={{ padding: "7px 14px", borderBottom: `1px solid ${C.rule}` }}>
                      <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3 }}>CONVICTION ADJUSTMENTS</span>
                    </div>
                    {agentData.veteran.conviction_adjustments.map((a, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < agentData.veteran.conviction_adjustments.length - 1 ? `1px solid ${C.rule2}` : "none" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: C.ink, minWidth: 70 }}>{a.ticker}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.ink3 }}>{a.original}/10</span>
                          <span style={{ fontSize: 10, color: a.direction === "UP" ? C.bull : C.bear }}>{a.direction === "UP" ? "▲" : "▼"}</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: a.direction === "UP" ? C.bull : C.bear }}>{a.revised}/10</span>
                        </div>
                        <span style={{ fontSize: 11, color: C.ink2, flex: 1 }}>{a.reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Timing + Contrarian + Sector disagreement */}
                {[
                  { label: "TIMING CORRECTION", value: agentData.veteran.timing_correction, color: C.ink3 },
                  { label: "CONTRARIAN CALL", value: agentData.veteran.contrarian_call, color: C.neutral },
                  { label: "SECTOR DISAGREEMENT", value: agentData.veteran.sector_disagreement, color: C.bear },
                ].map(item => item.value && (
                  <div key={item.label} style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: "12px 16px", marginBottom: 10, borderLeft: `3px solid ${item.color}` }}>
                    <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2.5, color: item.color, marginBottom: 6 }}>{item.label}</div>
                    <p style={{ margin: 0, fontSize: 12, color: C.ink2, lineHeight: 1.7, fontStyle: "italic" }}>{item.value}</p>
                  </div>
                ))}

              </div>
            )}

                        {/* ── TECHNICAL ── */}
            {activeTab === "technical" && (
              <div>
                {agentData.technical?.raw?.some(t => !t.error) && (
                  <div style={{ background: C.paper, border: `1px solid ${C.rule}`, marginBottom: 14 }}>
                    <div style={{ padding: "7px 14px", borderBottom: `1px solid ${C.rule}` }}>
                      <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3 }}>LIVE PRICE DATA — YAHOO FINANCE</span>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${C.rule}` }}>
                            {["TICKER","PRICE","1D%","52W LOW","52W HIGH","RANGE POS","MA50","MA200","TREND","VOL RATIO"].map(h => (
                              <th key={h} style={{ padding: "6px 10px", fontSize: 8, letterSpacing: 1.5, color: C.ink4, fontWeight: 700, textAlign: "left" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {agentData.technical.raw.map((t, i) => {
                            const ts = agentData.technical?.stocks?.find(s => s.ticker === t.ticker);
                            const trend = ts?.trend || (t.aboveMa50 && t.goldenCross ? "UPTREND" : !t.aboveMa50 && !t.goldenCross ? "DOWNTREND" : "MIXED");
                            return (
                              <tr key={i} style={{ borderBottom: `1px solid ${C.rule2}` }}>
                                <td style={{ padding: "8px 10px", fontWeight: 700, color: C.ink }}>{t.ticker}</td>
                                <td style={{ padding: "8px 10px", color: C.ink }}>₹{t.price || "—"}</td>
                                <td style={{ padding: "8px 10px", color: t.change1d > 0 ? C.bull : t.change1d < 0 ? C.bear : C.ink3 }}>{t.change1d != null ? (t.change1d > 0 ? "+" : "") + t.change1d + "%" : "—"}</td>
                                <td style={{ padding: "8px 10px", color: C.ink3 }}>₹{t.low52 || "—"}</td>
                                <td style={{ padding: "8px 10px", color: C.ink3 }}>₹{t.high52 || "—"}</td>
                                <td style={{ padding: "8px 10px" }}>
                                  {t.rangePos != null ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <div style={{ width: 50, height: 4, background: C.rule2, borderRadius: 2, position: "relative" }}>
                                        <div style={{ position: "absolute", left: 0, width: t.rangePos + "%", height: 4, background: t.rangePos > 70 ? C.bull : t.rangePos < 30 ? C.bear : C.neutral, borderRadius: 2 }} />
                                      </div>
                                      <span style={{ fontSize: 9, color: C.ink3 }}>{t.rangePos}%</span>
                                    </div>
                                  ) : "—"}
                                </td>
                                <td style={{ padding: "8px 10px", color: t.aboveMa50 ? C.bull : C.bear }}>₹{t.ma50 || "—"} {t.aboveMa50 != null ? (t.aboveMa50 ? "▲" : "▼") : ""}</td>
                                <td style={{ padding: "8px 10px", color: t.aboveMa200 ? C.bull : C.bear }}>₹{t.ma200 || "—"} {t.aboveMa200 != null ? (t.aboveMa200 ? "▲" : "▼") : ""}</td>
                                <td style={{ padding: "8px 10px" }}><Stamp text={trend} color={trend === "UPTREND" ? C.bull : trend === "DOWNTREND" ? C.bear : C.neutral} /></td>
                                <td style={{ padding: "8px 10px", color: t.volRatio > 1.5 ? C.bull : t.volRatio < 0.7 ? C.bear : C.ink3 }}>{t.volRatio != null ? t.volRatio + "x" : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {agentData.technical?.stocks?.map((t, i) => (
                  <div key={i} style={{ background: C.paper, border: `1px solid ${C.rule}`, borderLeft: `4px solid ${t.technical_signal === "BULLISH" ? C.bull : t.technical_signal === "BEARISH" ? C.bear : C.neutral}`, marginBottom: 10, padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: C.ink }}>{t.ticker}</span>
                      <Stamp text={t.technical_signal} color={t.technical_signal === "BULLISH" ? C.bull : t.technical_signal === "BEARISH" ? C.bear : C.neutral} />
                      <Stamp text={t.trend} color={t.trend === "UPTREND" ? C.bull : t.trend === "DOWNTREND" ? C.bear : C.neutral} />
                      <Stamp text={"MOMENTUM: " + t.momentum} />
                      <span style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.ink3 }}>Tech score: {t.technical_score}/10</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", border: `1px solid ${C.rule2}`, marginBottom: 8 }}>
                      {[
                        { label: "SUPPORT", value: t.key_support ? "₹" + t.key_support : "—", color: C.bull },
                        { label: "RESISTANCE", value: t.key_resistance ? "₹" + t.key_resistance : "—", color: C.bear },
                        { label: "BEAR TARGET", value: t.bear_pct != null ? (t.bear_pct > 0 ? "+" : "") + t.bear_pct + "%" : "—", color: C.bear },
                        { label: "BULL TARGET", value: t.bull_pct != null ? "+" + t.bull_pct + "%" : "—", color: C.bull },
                      ].map((cell, ci) => (
                        <div key={ci} style={{ padding: "8px 10px", borderRight: ci < 3 ? `1px solid ${C.rule2}` : "none", textAlign: "center" }}>
                          <div style={{ fontSize: 7, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1.5, color: C.ink4, marginBottom: 3 }}>{cell.label}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: cell.color, fontFamily: "'IBM Plex Mono', monospace" }}>{cell.value}</div>
                        </div>
                      ))}
                    </div>
                    {t.range_comment && <p style={{ margin: "0 0 3px", fontSize: 11, color: C.ink3 }}>{t.range_comment}</p>}
                    {t.volume_comment && <p style={{ margin: "0 0 3px", fontSize: 11, color: C.ink3 }}>{t.volume_comment}</p>}
                    {t.technical_note && <p style={{ margin: "4px 0 0", fontSize: 11, color: C.ink2, fontStyle: "italic" }}>"{t.technical_note}"</p>}
                  </div>
                ))}

                {agentData.technical?.technical_summary && (
                  <div style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: "12px 16px", borderLeft: `3px solid ${C.ink2}` }}>
                    <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink3, marginBottom: 6 }}>OVERALL TECHNICAL PICTURE</div>
                    <p style={{ margin: 0, fontSize: 13, color: C.ink2, lineHeight: 1.7 }}>{agentData.technical.technical_summary}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── AGENTS RAW ── */}
            {activeTab === "raw" && (
              <div>
                {AGENTS.map(a => agentData[a.id] && (
                  <div key={a.id} style={{ border: `1px solid ${C.rule}`, marginBottom: 8, background: C.paper }}>
                    <button onClick={() => setExpandedAgent(expandedAgent === a.id ? null : a.id)} style={{
                      width: "100%", padding: "10px 14px", background: "transparent",
                      border: "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                    }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: 1 }}>{a.label.toUpperCase()}</span>
                      <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.ink3 }}>{a.desc}</span>
                      <span style={{ marginLeft: "auto", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.ink4 }}>{agentDuration[a.id]}s  {expandedAgent === a.id ? "▲" : "▼"}</span>
                    </button>
                    {expandedAgent === a.id && (
                      <pre style={{ margin: 0, padding: 14, fontSize: 9, color: C.ink3, lineHeight: 1.6, overflowX: "auto", background: C.bg, maxHeight: 280, overflowY: "auto", borderTop: `1px solid ${C.rule2}`, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {JSON.stringify(agentData[a.id], null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 9, color: C.ink4, textAlign: "center", marginTop: 28, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1 }}>
              NOT FINANCIAL ADVICE  ·  FOR EDUCATIONAL PURPOSES ONLY  ·  DO YOUR OWN RESEARCH
            </p>
          </div>
        )}

        {/* Empty state */}
        {!result && !running && Object.keys(agentStatus).length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 12, color: C.rule, fontFamily: "'Playfair Display', serif" }}>◎</div>
            <p style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 3, color: C.ink4, margin: 0 }}>AWAITING EVENT INPUT</p>
            <p style={{ fontSize: 10, color: C.rule, margin: "8px 0 0", fontFamily: "'IBM Plex Mono', monospace" }}>7 agents ready · India-focused</p>
          </div>
        )}
      </div>
    </div>
  );
}
