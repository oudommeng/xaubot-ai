/**
 * Script to generate src/data/books.ts from documentation files.
 * Run: node scripts/generate-books.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(__dirname, "..", "src", "data", "books.ts");

// Define all books with their source files and metadata (Indonesian)
const bookDefs = [
  // Getting Started
  { slug: "readme", title: "README", category: "Getting Started", icon: "BookOpen", description: "Project overview, installation and quick start for XAUBot AI", file: path.join(ROOT, "README.md") },
  { slug: "features", title: "Features & Components", category: "Getting Started", icon: "Sparkles", description: "Full feature list — 14 entry filters, 12 exit conditions, risk management", file: path.join(ROOT, "docs", "FEATURES.md") },
  { slug: "architecture-full", title: "Full Architecture", category: "Getting Started", icon: "LayoutDashboard", description: "Complete system architecture — data flow, components and module interactions", file: path.join(ROOT, "docs", "arsitektur-ai", "00-ARSITEKTUR-LENGKAP.md") },
  { slug: "architecture-index", title: "Architecture Index", category: "Getting Started", icon: "List", description: "List of all architecture documents and current component status", file: path.join(ROOT, "docs", "arsitektur-ai", "README.md") },

  // AI & Analysis
  { slug: "hmm-regime", title: "HMM Regime Detector", category: "AI & Analysis", icon: "Brain", description: "Market condition detection with a 3-state Hidden Markov Model", file: path.join(ROOT, "docs", "arsitektur-ai", "01-HMM-Regime-Detector.md") },
  { slug: "xgboost", title: "XGBoost Signal Predictor", category: "AI & Analysis", icon: "Cpu", description: "Machine learning model for BUY/SELL/HOLD signal prediction", file: path.join(ROOT, "docs", "arsitektur-ai", "02-XGBoost-Signal-Predictor.md") },
  { slug: "smc", title: "SMC Analyzer", category: "AI & Analysis", icon: "TrendingUp", description: "Smart Money Concepts analysis — Order Block, FVG, BOS, CHoCH", file: path.join(ROOT, "docs", "arsitektur-ai", "03-SMC-Analyzer.md") },
  { slug: "feature-eng", title: "Feature Engineering", category: "AI & Analysis", icon: "Layers", description: "37 technical features — RSI, ATR, MACD, Bollinger and more", file: path.join(ROOT, "docs", "arsitektur-ai", "04-Feature-Engineering.md") },

  // Risk & Protection
  { slug: "risk-management", title: "Risk Management", category: "Risk & Protection", icon: "Shield", description: "Dynamic risk management with capital modes and daily limits", file: path.join(ROOT, "docs", "arsitektur-ai", "05-Risk-Management.md") },
  { slug: "session-filter", title: "Session Filter", category: "Risk & Protection", icon: "Clock", description: "Trading session filter — Sydney, London, New York in WIB time", file: path.join(ROOT, "docs", "arsitektur-ai", "06-Session-Filter.md") },
  { slug: "stop-loss", title: "Stop Loss", category: "Risk & Protection", icon: "ShieldAlert", description: "ATR-based and broker-level SL protection for maximum safety", file: path.join(ROOT, "docs", "arsitektur-ai", "07-Stop-Loss.md") },
  { slug: "take-profit", title: "Take Profit", category: "Risk & Protection", icon: "Target", description: "Multi-level TP targets from ATR and market structure", file: path.join(ROOT, "docs", "arsitektur-ai", "08-Take-Profit.md") },

  // Trading Process
  { slug: "entry-trade", title: "Entry Trade", category: "Trading Process", icon: "ArrowRightCircle", description: "14 entry filters and trade execution logic — from signal to order", file: path.join(ROOT, "docs", "arsitektur-ai", "09-Entry-Trade.md") },
  { slug: "exit-trade", title: "Exit Trade", category: "Trading Process", icon: "ArrowLeftCircle", description: "12 exit conditions including trailing SL, time limit and regime change", file: path.join(ROOT, "docs", "arsitektur-ai", "10-Exit-Trade.md") },

  // Infrastructure
  { slug: "news-agent", title: "News Agent", category: "Infrastructure", icon: "Newspaper", description: "Economic news filter — blocks entries around NFP / FOMC / CPI", file: path.join(ROOT, "docs", "arsitektur-ai", "11-News-Agent.md") },
  { slug: "telegram", title: "Telegram Notifications", category: "Infrastructure", icon: "Send", description: "Real-time trade alerts and daily summaries via Telegram bot", file: path.join(ROOT, "docs", "arsitektur-ai", "12-Telegram-Notifications.md") },
  { slug: "auto-trainer", title: "Auto Trainer", category: "Infrastructure", icon: "RefreshCw", description: "Automatic retraining pipeline when market conditions change", file: path.join(ROOT, "docs", "arsitektur-ai", "13-Auto-Trainer.md") },
  { slug: "backtest", title: "Backtest", category: "Infrastructure", icon: "BarChart3", description: "Backtesting framework synced with the live trading logic", file: path.join(ROOT, "docs", "arsitektur-ai", "14-Backtest.md") },
  { slug: "dynamic-confidence", title: "Dynamic Confidence", category: "Infrastructure", icon: "Gauge", description: "Adaptive confidence threshold based on market conditions and performance", file: path.join(ROOT, "docs", "arsitektur-ai", "15-Dynamic-Confidence.md") },
  { slug: "train-models", title: "Train Models", category: "Infrastructure", icon: "GraduationCap", description: "Model training pipeline and XGBoost hyperparameter tuning", file: path.join(ROOT, "docs", "arsitektur-ai", "22-Train-Models.md") },

  // Connectors & Config
  { slug: "mt5-connector", title: "MT5 Connector", category: "Connectors & Config", icon: "Plug", description: "MetaTrader 5 connection layer and order execution", file: path.join(ROOT, "docs", "arsitektur-ai", "16-MT5-Connector.md") },
  { slug: "configuration", title: "Configuration", category: "Connectors & Config", icon: "Settings", description: "Trading settings, capital modes and environment configuration", file: path.join(ROOT, "docs", "arsitektur-ai", "17-Configuration.md") },
  { slug: "trade-logger", title: "Trade Logger", category: "Connectors & Config", icon: "FileText", description: "Trade logging to PostgreSQL for historical analysis", file: path.join(ROOT, "docs", "arsitektur-ai", "18-Trade-Logger.md") },
  { slug: "position-manager", title: "Position Manager", category: "Connectors & Config", icon: "ListChecks", description: "Real-time tracking and management of open positions", file: path.join(ROOT, "docs", "arsitektur-ai", "19-Position-Manager.md") },

  // Engine & Data
  { slug: "risk-engine", title: "Risk Engine", category: "Engine & Data", icon: "Calculator", description: "Risk calculation, Kelly criterion and automatic position sizing", file: path.join(ROOT, "docs", "arsitektur-ai", "20-Risk-Engine.md") },
  { slug: "database", title: "Database", category: "Engine & Data", icon: "Database", description: "PostgreSQL schema and trade data storage", file: path.join(ROOT, "docs", "arsitektur-ai", "21-Database.md") },

  // Orchestrator
  { slug: "main-live", title: "Main Orchestrator", category: "Orchestrator", icon: "Play", description: "Async main loop — the core of the bot that coordinates all components", file: path.join(ROOT, "docs", "arsitektur-ai", "23-Main-Live-Orchestrator.md") },

  // Analysis
  { slug: "weakness-analysis", title: "Weakness Analysis", category: "Analysis", icon: "AlertTriangle", description: "Known weaknesses, risks and improvement priorities", file: path.join(ROOT, "docs", "WEAKNESS_ANALYSIS.md") },
];

function escapeForTemplate(str) {
  // Escape backticks and ${} in template literals
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

// Ensure output directory exists
const outDir = path.dirname(OUT);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

let output = `// AUTO-GENERATED — do not edit manually.
// Run: node scripts/generate-books.js

export interface BookEntry {
  slug: string;
  title: string;
  category: string;
  icon: string;
  description: string;
  content: string;
}

export const categories = [
  "Getting Started",
  "AI & Analysis",
  "Risk & Protection",
  "Trading Process",
  "Infrastructure",
  "Connectors & Config",
  "Engine & Data",
  "Orchestrator",
  "Analysis",
] as const;

export type Category = (typeof categories)[number];

export const books: BookEntry[] = [\n`;

for (const def of bookDefs) {
  let content = "";
  try {
    content = fs.readFileSync(def.file, "utf-8");
  } catch (e) {
    console.warn(`WARNING: Could not read ${def.file}: ${e.message}`);
    content = `# ${def.title}\n\n*Dokumen tidak ditemukan.*`;
  }

  output += `  {
    slug: ${JSON.stringify(def.slug)},
    title: ${JSON.stringify(def.title)},
    category: ${JSON.stringify(def.category)},
    icon: ${JSON.stringify(def.icon)},
    description: ${JSON.stringify(def.description)},
    content: \`${escapeForTemplate(content)}\`,
  },\n`;
}

output += `];\n`;

fs.writeFileSync(OUT, output, "utf-8");
console.log(`Generated ${OUT} with ${bookDefs.length} books.`);
