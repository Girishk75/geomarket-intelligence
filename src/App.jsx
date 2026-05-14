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
    const apiKey = localStorage.getItem("geomarket_api_key") || "";
    if (!apiKey) throw new Error("No API key");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
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
    system: `Indian equity market orchestrator. Return ONLY valid JSON, no markdown.
{"event_type":"GEOPOLITICAL|MACRO|POLICY|TRADE|CONFLICT","urgency":"HIGH|MEDIUM|LOW","focus_sectors":["s1","s2","s3"],"macro_themes":["t1","t2"],"geopolitical_category":"CONFLICT|SANCTIONS|DIPLOMACY|TRADE_WAR|OTHER","india_direct_exposure":"HIGH|MEDIUM|LOW","mission_brief":"one sentence"}
Sectors: Defence & Aerospace, Pharma, IT & Tech, Energy & Oil, Banking & NBFC, Metals & Mining, FMCG, Auto & EV, Agri & Chemicals, Renewables, Gold & Commodities. Max 3 focus_sectors.`,
    user: `Event to analyze: "${event}"`
  };
}

function geopoliticalPrompt(event, orchestration) {
  return {
    system: `Geopolitical analyst for India. Return ONLY valid JSON, no markdown.
{"context":"2 sentences","historical_parallel":"1 sentence","escalation_probability":"HIGH|MEDIUM|LOW","india_direct_impact":"1 sentence","india_indirect_impact":"1 sentence","timeline_estimate":"SHORT (days)|MEDIUM (weeks)|LONG (months+)"}`,
    user: `Event: "${event}"
Focus sectors: ${orchestration.focus_sectors?.join(", ")}
Event type: ${orchestration.event_type} | Category: ${orchestration.geopolitical_category}
India exposure: ${orchestration.india_direct_exposure}
Provide geopolitical intelligence.`
  };
}

function macroPrompt(event, orchestration, geopolitical) {
  return {
    system: `Indian macro economist. Return ONLY valid JSON, no markdown.
{"macro_signal":"RISK-ON|RISK-OFF|MIXED","signal_strength":"STRONG|MODERATE|WEAK","inr_outlook":{"direction":"DEPRECIATION|APPRECIATION|STABLE","magnitude":"1-2%|3-5%|5%+","reasoning":"1 sentence"},"fii_flow_expectation":"OUTFLOW|INFLOW|NEUTRAL","inflation_impact":"UP|DOWN|NEUTRAL","rbi_likely_response":"RATE_CUT|RATE_HIKE|HOLD|INTERVENTION","crude_oil_impact":"UP|DOWN|NEUTRAL","gold_impact":"UP|DOWN|NEUTRAL","trade_balance_effect":"WIDEN|NARROW|NEUTRAL","key_macro_insight":"1 sentence"}`,
    user: `Event: "${event}"
Geo: escalation=${geopolitical.escalation_probability}, timeline=${geopolitical.timeline_estimate}
India impact: ${geopolitical.india_direct_impact}
Historical parallel: ${geopolitical.historical_parallel}
Provide macro analysis for Indian markets.`
  };
}

function sectorPrompt(event, orchestration, geopolitical, macro) {
  return {
    system: `NSE sector analyst. Max 3 sectors, 2 companies each. Return ONLY valid JSON, no markdown.
{"sectors":[{"name":"sector","impact":"BULLISH|BEARISH|NEUTRAL","impact_score":5,"conviction":"HIGH|MEDIUM|LOW","thesis":"1 sentence","key_drivers":["d1","d2"],"companies":[{"name":"Co (NSE: TICK)","impact":"BULLISH|BEARISH|NEUTRAL","conviction_score":8,"reason":"1 sentence","market_cap":"LARGE|MID|SMALL"}]}]}
NSE-listed companies only. Be concise.`,
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
    system: `NSE stock picker. Return ONLY valid JSON, no markdown. Max 4 picks, 2 avoids.
{"top_picks":[{"company":"Name","ticker":"NSE_TICK","action":"BUY|SELL|WATCH","conviction":8,"thesis":"1 sentence","catalyst":"1 sentence","risk":"1 sentence","holding_period":"3-6 weeks","sector":"sector"}],"avoid_list":[{"company":"Name (TICK)","reason":"1 sentence"}],"theme_play":"1 sentence","index_outlook":"1 sentence"}`,
    user: `Event: "${event}"
Macro: ${macro.macro_signal}, INR ${macro.inr_outlook?.direction}, FII ${macro.fii_flow_expectation}
Sectors: ${sectors.sectors?.map(s => s.name + "(" + s.impact + " " + s.impact_score + "): " + s.companies?.map(c => c.name).join(", ")).join(" | ")}

Identify highest conviction stock picks.`
  };
}

function riskPrompt(event, orchestration, geopolitical, macro, sectors, stocks) {
  return {
    system: `Devil's advocate for Indian equity analysis. Return ONLY valid JSON, no markdown. Max 3 risk flags.
{"risk_flags":[{"title":"title","severity":"CRITICAL|HIGH|MEDIUM|LOW","probability":"HIGH|MEDIUM|LOW","description":"1 sentence","affected_picks":["TICK"]}],"bear_case":"1 sentence","contrarian_view":"1 sentence","black_swan":"1 sentence","overall_risk_rating":"HIGH|MEDIUM|LOW"}`,
    user: `Event: "${event}"
Macro: ${macro.macro_signal} ${macro.signal_strength} | INR: ${macro.inr_outlook?.direction} | FII: ${macro.fii_flow_expectation}
Geo escalation: ${geopolitical.escalation_probability} | RBI: ${macro.rbi_likely_response}
Picks: ${stocks.top_picks?.map(p => p.ticker + "(" + p.action + ")").join(", ")}
Sectors: ${sectors.sectors?.map(s => s.name + "(" + s.impact + ")").join(", ")}
What is everyone missing? What could go badly wrong?`
  };
}


function veteranPrompt(event, geo, macro, sectors, stocks, risks, tech) {
  const picksStr = stocks.top_picks?.map(p => p.ticker + "(" + p.action + " conviction:" + p.fundamental_score + "/" + p.sentiment_score + ")").join(", ") || "";
  const techStr  = tech?.stocks?.map(t => t.ticker + ":tech=" + t.technical_score + " " + t.trend).join(", ") || "N/A";
  return {
    system: `25yr Indian market veteran. Blunt. Zero consensus tolerance. Return ONLY valid JSON, no markdown. Max 2 overrides, 2 missed picks.
{"overall_verdict":"APPROVED|CHALLENGED|MIXED","verdict_stamp":"1 sentence","overrides":[{"ticker":"T","original_action":"BUY","revised_action":"HOLD","reason":"1 sentence"}],"missed_picks":[{"ticker":"T","company":"C","action":"BUY|SELL","conviction":8,"reason":"1 sentence"}],"timing_correction":"1 sentence","contrarian_call":"1 sentence","sector_disagreement":"1 sentence","final_verdict":"2 sentences"}`,
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
    system: `Indian market intelligence synthesizer. Return ONLY valid JSON, no markdown.
{"headline":"8 words","executive_summary":"2 sentences","macro_signal":"RISK-ON|RISK-OFF|MIXED","signal_strength":"STRONG|MODERATE|WEAK","india_angle":"1 sentence","time_horizon":"SHORT (days)|MEDIUM (weeks)|LONG (months)","top_sectors":[{"name":"s","impact":"BULLISH|BEARISH|NEUTRAL","score":5}],"final_picks":[{"ticker":"T","company":"C","action":"BUY|SELL|WATCH","conviction":8,"one_liner":"1 sentence","holding_period":"3-6 weeks","bear_pct":-10,"base_pct":18,"bull_pct":32}],"key_risks":["r1","r2"],"contrarian_take":"1 sentence","watchlist":["T1","T2","T3"]}`,
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
  const apiKey = localStorage.getItem("geomarket_api_key") || "";
  if (!apiKey) throw new Error("No API key. Click ⚙ Settings to add your Anthropic API key.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
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
        <div style={{ flex: 1, height: 1,
