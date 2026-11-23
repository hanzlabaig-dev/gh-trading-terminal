'use strict';
// All colours are plain hex presentation values: GitHub's image proxy strips <style>/CSS.
const THEMES = {
  tradingview: { bg: '#131722', panel: '#1a1e2c', grid: '#2a2e39', text: '#d1d4dc', muted: '#787b86', up: '#26a69a', down: '#ef5350', accent: '#2962ff', ma: '#f7a600' },
  bloomberg:   { bg: '#000000', panel: '#0c0a06', grid: '#2e2410', text: '#ffb000', muted: '#a07010', up: '#00d26a', down: '#ff3b30', accent: '#ff9f0a', ma: '#00b7ff' },
  midnight:    { bg: '#0d1117', panel: '#151b23', grid: '#21262d', text: '#e6edf3', muted: '#7d8590', up: '#3fb950', down: '#f85149', accent: '#58a6ff', ma: '#d29922' },
  light:       { bg: '#ffffff', panel: '#f6f8fa', grid: '#d8dee4', text: '#1f2328', muted: '#656d76', up: '#1a7f37', down: '#cf222e', accent: '#0969da', ma: '#bf8700' },
};
const COLORBLIND = { up: '#2f81f7', down: '#f0883e' };
module.exports = { THEMES, COLORBLIND };
