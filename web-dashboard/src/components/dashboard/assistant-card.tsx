"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot, TrendingUp, TrendingDown, ShieldAlert, Clock, Zap,
  AlertTriangle, Coffee, CheckCircle2, XCircle, Minus,
  Activity, Target, BarChart3, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TradingStatus } from "@/types/trading";

type InsightType = "info" | "success" | "warning" | "danger";

interface Insight {
  icon: React.ReactNode;
  text: string;
  type: InsightType;
}

const typeStyles: Record<InsightType, string> = {
  info: "text-blue-400/90",
  success: "text-apple-green",
  warning: "text-orange-400",
  danger: "text-apple-red",
};

const sessionNames: Record<string, string> = {
  sydney: "Sydney", tokyo: "Tokyo", london: "London",
  new_york: "New York", off_hours: "Off Hours",
};

function generateInsights(data: TradingStatus): Insight[] {
  const insights: Insight[] = [];
  const hasPositions = data.positions && data.positions.length > 0;
  const sessionName = sessionNames[data.session?.toLowerCase()] || data.session;
  const regimeName = data.regime?.name || "unknown";
  const regimeConf = data.regime?.confidence ? (data.regime.confidence * 100).toFixed(0) : "?";
  const smcSignal = data.smc?.signal || "NONE";
  const smcConf = data.smc?.confidence ? (data.smc.confidence * 100).toFixed(0) : "0";
  const mlSignal = data.ml?.signal || "HOLD";
  const mlConf = data.ml?.confidence ? (data.ml.confidence * 100).toFixed(0) : "0";
  const h1Bias = data.h1Bias || "N/A";
  const dynThreshold = data.dynamicThreshold ? (data.dynamicThreshold * 100).toFixed(0) : "60";
  const spread = data.spread?.toFixed(1) || "?";

  // ═══════════════════════════════════════════
  // 1. MARKET STATUS
  // ═══════════════════════════════════════════
  if (data.marketClose && !data.marketClose.marketOpen) {
    insights.push({
      icon: <Coffee className="h-3.5 w-3.5" />,
      text: "Market is closed. Bot is on standby — no analysis or execution. Waiting for the market to reopen.",
      type: "info",
    });
    return insights;
  }

  if (data.marketClose?.nearWeekend) {
    const hrs = data.marketClose.hoursToWeekendClose;
    insights.push({
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      text: `Warning: weekend close in ${hrs.toFixed(1)} hours (Saturday 05:00 WIB). The bot will reject new entries and make sure all positions are closed before the market closes.`,
      type: "warning",
    });
  }

  // ═══════════════════════════════════════════
  // 2. SITUATION SUMMARY (top-level)
  // ═══════════════════════════════════════════
  if (hasPositions) {
    const totalProfit = data.positions.reduce((sum, p) => sum + p.profit, 0);
    const profitStr = totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`;
    insights.push({
      icon: <Activity className="h-3.5 w-3.5" />,
      text: `In position (${data.positions.length} active trade(s), total P/L: ${profitStr}). Bot checks exit conditions every 5 seconds.`,
      type: totalProfit >= 0 ? "success" : "warning",
    });
  } else {
    insights.push({
      icon: <Eye className="h-3.5 w-3.5" />,
      text: `No open positions. Bot analyzes the market every M15 candle looking for entry opportunities.`,
      type: "info",
    });
  }

  // ═══════════════════════════════════════════
  // 3. SESSION & TIME
  // ═══════════════════════════════════════════
  if (data.isGoldenTime) {
    insights.push({
      icon: <Zap className="h-3.5 w-3.5" />,
      text: `${sessionName} session — GOLDEN TIME! The London-NY overlap has the highest volatility. Lot size multiplied by ${data.sessionMultiplier || 1}x. Best entry opportunities.`,
      type: "success",
    });
  } else if (!data.canTrade) {
    const nextSession = data.session?.toLowerCase() === "off_hours" ? "Sydney (06:00 WIB)"
      : data.session?.toLowerCase() === "sydney" ? "London (15:00 WIB)"
      : "the next session";
    insights.push({
      icon: <Clock className="h-3.5 w-3.5" />,
      text: `${sessionName} session — outside active trading hours. Low volume, spread can widen. Waiting for ${nextSession}.`,
      type: "info",
    });
  } else {
    const multiplierText = data.sessionMultiplier && data.sessionMultiplier > 1
      ? ` Lot multiplier: ${data.sessionMultiplier}x.`
      : data.sessionMultiplier && data.sessionMultiplier < 1
      ? ` SAFE MODE: lot reduced to ${data.sessionMultiplier}x.`
      : "";
    insights.push({
      icon: <Clock className="h-3.5 w-3.5" />,
      text: `${sessionName} session active — market open for trading.${multiplierText}`,
      type: "info",
    });
  }

  if (data.timeFilter?.isBlocked) {
    insights.push({
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      text: `${data.timeFilter.wibHour}:00 WIB is blocked by the time filter (hours with a historically low win rate). Entry postponed.`,
      type: "warning",
    });
  }

  // ═══════════════════════════════════════════
  // 4. MARKET CONDITIONS (regime + spread + H1)
  // ═══════════════════════════════════════════
  const regimeDetail = regimeName.includes("trending")
    ? `Market trending (HMM confidence ${regimeConf}%) — ideal conditions. Price moves with direction, signals are more reliable.`
    : regimeName.includes("high_volatility") || regimeName.includes("volatile")
    ? `High volatility (HMM ${regimeConf}%) — CAREFUL! Wild price moves, SL can be hit quickly. Bot raises its spread tolerance.`
    : regimeName.includes("low_volatility") || regimeName.includes("ranging")
    ? `Low volatility / ranging (HMM ${regimeConf}%) — quiet market, few opportunities. Bot waits for a breakout or a regime change.`
    : `Regime: ${regimeName} (HMM ${regimeConf}%).`;

  insights.push({
    icon: regimeName.includes("trending") ? <TrendingUp className="h-3.5 w-3.5" />
      : regimeName.includes("volatile") || regimeName.includes("high") ? <AlertTriangle className="h-3.5 w-3.5" />
      : <BarChart3 className="h-3.5 w-3.5" />,
    text: regimeDetail,
    type: regimeName.includes("trending") ? "success"
      : regimeName.includes("volatile") || regimeName.includes("high") ? "warning"
      : "info",
  });

  // H1 Bias detail
  if (h1Bias && h1Bias !== "N/A") {
    const h1Text = h1Bias === "BULLISH"
      ? `H1 Bias: BULLISH — price above H1 EMA20, medium-term uptrend. BUY entries allowed.`
      : h1Bias === "BEARISH"
      ? `H1 Bias: BEARISH — price below H1 EMA20, medium-term downtrend. SELL entries allowed.`
      : `H1 Bias: NEUTRAL — price near H1 EMA20, no clear trend. Entries on hold until a direction forms.`;
    insights.push({
      icon: h1Bias === "BULLISH" ? <TrendingUp className="h-3.5 w-3.5" />
        : h1Bias === "BEARISH" ? <TrendingDown className="h-3.5 w-3.5" />
        : <Minus className="h-3.5 w-3.5" />,
      text: h1Text,
      type: h1Bias === "NEUTRAL" ? "warning" : "info",
    });
  }

  // Spread
  insights.push({
    icon: <Activity className="h-3.5 w-3.5" />,
    text: `Current spread: ${spread} pips. ${parseFloat(spread) > 40 ? "Quite wide — entry may be postponed." : parseFloat(spread) > 25 ? "Normal." : "Tight — good conditions."}`,
    type: parseFloat(spread) > 40 ? "warning" : "info",
  });

  // ═══════════════════════════════════════════
  // 5. SIGNAL ANALYSIS
  // ═══════════════════════════════════════════
  if (smcSignal !== "NONE" && smcSignal !== "HOLD") {
    const smcReason = data.smc?.reason || "";
    const mlAgrees = mlSignal === smcSignal;
    const mlAboveThreshold = data.ml?.confidence && data.ml.confidence * 100 >= parseFloat(dynThreshold);

    if (mlAgrees && mlAboveThreshold) {
      insights.push({
        icon: <Zap className="h-3.5 w-3.5" />,
        text: `STRONG SIGNAL: SMC ${smcSignal} (${smcConf}%) + ML ${mlSignal} (${mlConf}%) — both agree and are above the ${dynThreshold}% threshold.${smcReason ? ` SMC: ${smcReason}.` : ""} Only the other filters need to pass for entry.`,
        type: "success",
      });
    } else if (mlAgrees && !mlAboveThreshold) {
      insights.push({
        icon: <Target className="h-3.5 w-3.5" />,
        text: `SMC ${smcSignal} (${smcConf}%) & ML agree on ${mlSignal}, but ML confidence (${mlConf}%) is still below the threshold (${dynThreshold}%). Needs more conviction.`,
        type: "warning",
      });
    } else {
      insights.push({
        icon: <Minus className="h-3.5 w-3.5" />,
        text: `Conflicting signals — SMC: ${smcSignal} (${smcConf}%) vs ML: ${mlSignal} (${mlConf}%). Bot waits for both models to agree before entry.${smcReason ? ` SMC: ${smcReason}.` : ""}`,
        type: "info",
      });
    }
  } else {
    insights.push({
      icon: <Minus className="h-3.5 w-3.5" />,
      text: `No signal yet — SMC: ${smcSignal}, ML: ${mlSignal} (${mlConf}%). Waiting for a setup to form on the next M15 candle.`,
      type: "info",
    });
  }

  // ═══════════════════════════════════════════
  // 6. OPEN POSITIONS (detail)
  // ═══════════════════════════════════════════
  if (hasPositions) {
    for (const pos of data.positions) {
      const detail = data.positionDetails?.find((d) => d.ticket === pos.ticket);
      const profitStr = pos.profit >= 0 ? `+$${pos.profit.toFixed(2)}` : `-$${Math.abs(pos.profit).toFixed(2)}`;
      const dir = pos.type;

      const ageMinutes = detail?.tradeHours ? detail.tradeHours * 60 : 0;
      const ageText = ageMinutes > 0
        ? ageMinutes < 60 ? `${ageMinutes.toFixed(0)}m` : `${(ageMinutes / 60).toFixed(1)}h`
        : "";
      const momentumVal = detail?.momentum ?? 0;
      const tpProb = detail?.tpProbability ?? 0;
      const peakProfit = detail?.peakProfit ?? 0;
      const drawdown = detail?.drawdownFromPeak ?? 0;
      const reversalWarns = detail?.reversalWarnings ?? 0;

      let analysis = "";
      if (pos.profit >= 20) {
        analysis = `Very good profit! Trailing SL is active and locking in gains. Peak: $${peakProfit.toFixed(2)}, drawdown from peak: $${drawdown.toFixed(2)}. TP probability: ${tpProb.toFixed(0)}%.`;
      } else if (pos.profit >= 10) {
        analysis = `Good profit — momentum ${momentumVal > 0 ? "positive" : "weakening"} (${momentumVal.toFixed(0)}). Peak profit: $${peakProfit.toFixed(2)}. ${tpProb > 50 ? "Chance of reaching TP is still high." : "Start watching to take profit."}`;
      } else if (pos.profit >= 0) {
        analysis = `Floating ${profitStr} (${ageText}). Momentum: ${momentumVal.toFixed(0)}. ${ageMinutes < 15 ? "Still in the 15-minute grace period — let the trade develop." : "Watching the next move."}`;
      } else if (ageMinutes < 15) {
        analysis = `Loss ${profitStr} but still in the GRACE PERIOD (${ageText}/15m). Early cut is NOT active — giving it 1 M15 candle to develop. Hard SL remains the safety net.`;
      } else {
        analysis = `Loss ${profitStr} (${ageText}), momentum: ${momentumVal.toFixed(0)}. ${momentumVal < -50 ? "Weak momentum — early cut can trigger at any time!" : "Momentum not too bad yet, recovery still possible."}${reversalWarns > 0 ? ` Reversal warning: ${reversalWarns}x.` : ""}`;
      }

      insights.push({
        icon: pos.profit >= 5 ? <TrendingUp className="h-3.5 w-3.5" />
          : pos.profit >= 0 ? <Clock className="h-3.5 w-3.5" />
          : pos.profit > -15 ? <AlertTriangle className="h-3.5 w-3.5" />
          : <ShieldAlert className="h-3.5 w-3.5" />,
        text: `📊 #${pos.ticket} ${dir} @ ${pos.priceOpen.toFixed(2)} — ${analysis}`,
        type: pos.profit >= 5 ? "success" : pos.profit >= 0 ? "info" : pos.profit > -15 ? "warning" : "danger",
      });
    }
  }

  // ═══════════════════════════════════════════
  // 7. WHY NO ENTRY (detail per filter)
  // ═══════════════════════════════════════════
  if (!hasPositions) {
    const filters = data.entryFilters || [];
    const blockers = filters.filter((f) => !f.passed && !f.detail?.includes("[DISABLED]"));
    const disabledFilters = filters.filter((f) => f.detail?.includes("[DISABLED]"));
    const passedCount = filters.filter((f) => f.passed).length;

    if (blockers.length > 0) {
      insights.push({
        icon: <XCircle className="h-3.5 w-3.5" />,
        text: `Entry blocked by ${blockers.length} filter(s) (${passedCount}/${filters.length} passed). First failing filter: "${blockers[0].name}" — ${blockers[0].detail || "conditions not met"}. The bot will not enter until ALL filters are green.`,
        type: "warning",
      });
    } else if (filters.length > 0 && blockers.length === 0) {
      insights.push({
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        text: `All ${filters.length} filters passed! Bot is ready to enter as soon as there is a valid SMC + ML signal.`,
        type: "success",
      });
    }

    if (disabledFilters.length > 0) {
      const names = disabledFilters.map((f) => f.name).join(", ");
      insights.push({
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        text: `${disabledFilters.length} filter(s) manually disabled: ${names}. These filters are bypassed (auto-pass). Re-enable them in the Filters panel if needed.`,
        type: "warning",
      });
    }
  }

  // ═══════════════════════════════════════════
  // 8. RISK & CAPITAL
  // ═══════════════════════════════════════════
  const netPnl = (data.dailyProfit || 0) - (data.dailyLoss || 0);
  if (data.dailyLoss > 0 || data.dailyProfit > 0) {
    const pnlStr = netPnl >= 0 ? `+$${netPnl.toFixed(2)}` : `-$${Math.abs(netPnl).toFixed(2)}`;
    const remaining = data.riskMode?.remainingDailyRisk;
    const riskDetail = remaining !== undefined ? ` Remaining daily risk: $${remaining.toFixed(0)}.` : "";

    if (netPnl < 0 && remaining !== undefined && remaining < 50) {
      insights.push({
        icon: <ShieldAlert className="h-3.5 w-3.5" />,
        text: `⚠️ Today's P/L: ${pnlStr} (loss $${data.dailyLoss.toFixed(2)}, profit $${data.dailyProfit.toFixed(2)}).${riskDetail} Close to the limit — bot is very conservative.`,
        type: "danger",
      });
    } else {
      insights.push({
        icon: netPnl >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />,
        text: `Today's P/L: ${pnlStr} (loss $${data.dailyLoss.toFixed(2)}, profit $${data.dailyProfit.toFixed(2)}).${riskDetail}`,
        type: netPnl >= 0 ? "success" : "warning",
      });
    }
  }

  if (data.riskMode) {
    const mode = data.riskMode.mode?.toUpperCase() || "NORMAL";
    if (mode !== "NORMAL") {
      insights.push({
        icon: <ShieldAlert className="h-3.5 w-3.5" />,
        text: `Risk mode: ${mode} — ${data.riskMode.reason}. Lot: ${data.riskMode.recommendedLot} (max ${data.riskMode.maxAllowedLot}).`,
        type: mode === "RECOVERY" || mode === "PROTECTIVE" ? "danger" : "warning",
      });
    }
  }

  // ═══════════════════════════════════════════
  // 9. BOT PERFORMANCE
  // ═══════════════════════════════════════════
  if (data.performance) {
    const p = data.performance;
    const uptimeText = p.uptimeHours < 1
      ? `${(p.uptimeHours * 60).toFixed(0)} minutes`
      : `${p.uptimeHours.toFixed(1)} hours`;
    insights.push({
      icon: <Bot className="h-3.5 w-3.5" />,
      text: `Bot running for ${uptimeText}, loop #${p.loopCount}. Avg execution: ${p.avgExecutionMs.toFixed(0)}ms. Session trades: ${p.totalSessionTrades} (P/L: ${p.totalSessionProfit >= 0 ? "+" : ""}$${p.totalSessionProfit.toFixed(2)}).`,
      type: "info",
    });
  }

  return insights;
}

interface AssistantCardProps {
  data: TradingStatus;
}

export function AssistantCard({ data }: AssistantCardProps) {
  const insights = generateInsights(data);
  const [wibTime, setWibTime] = useState("");

  useEffect(() => {
    const update = () => {
      setWibTime(
        new Date().toLocaleString("en-GB", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="glass h-full overflow-hidden flex flex-col accent-top-blue">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-1.5 uppercase tracking-wider text-blue-400">
          <Bot className="h-4 w-4" />
          Bot Assistant
          <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-muted-foreground/60 font-mono">
            {wibTime} WIB
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-2">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 text-[11px] leading-[1.5]"
            >
              <span className={cn("mt-0.5 shrink-0", typeStyles[insight.type])}>
                {insight.icon}
              </span>
              <span className="text-foreground/80">{insight.text}</span>
            </div>
          ))}
        </div>

        {/* Last analysis timestamp */}
        <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-muted-foreground/40 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {/* timestamp is already a WIB clock time ("HH:MM:SS"), not a parseable date */}
          Last analysis: {data.timestamp || wibTime} WIB
        </div>
      </CardContent>
    </Card>
  );
}
