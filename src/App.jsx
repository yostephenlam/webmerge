import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import * as prettier from 'prettier';

// ============================================================================
// DIFF ALGORITHM - LCS for accurate line-level diff
// ============================================================================

function computeLCS(left, right) {
  const m = left.length;
  const n = right.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (left[i - 1] === right[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      lcs.unshift({ leftIndex: i - 1, rightIndex: j - 1, value: left[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

function computeLineDiff(leftLines, rightLines, options = {}) {
  const { ignoreWhitespace, ignoreCase, ignoreBlankLines } = options;

  const processLine = (line) => {
    let processed = line;
    if (ignoreWhitespace) {
      processed = processed.replace(/\s+/g, ' ').trim();
    }
    if (ignoreCase) {
      processed = processed.toLowerCase();
    }
    return processed;
  };

  let leftFiltered = leftLines;
  let rightFiltered = rightLines;
  let leftMapping = leftLines.map((_, i) => i);
  let rightMapping = rightLines.map((_, i) => i);

  if (ignoreBlankLines) {
    leftFiltered = [];
    leftMapping = [];
    leftLines.forEach((line, i) => {
      if (line.trim()) {
        leftFiltered.push(line);
        leftMapping.push(i);
      }
    });
    rightFiltered = [];
    rightMapping = [];
    rightLines.forEach((line, i) => {
      if (line.trim()) {
        rightFiltered.push(line);
        rightMapping.push(i);
      }
    });
  }

  const leftProcessed = leftFiltered.map(processLine);
  const rightProcessed = rightFiltered.map(processLine);
  const lcs = computeLCS(leftProcessed, rightProcessed);

  const result = [];
  let leftIdx = 0;
  let rightIdx = 0;
  let lcsIdx = 0;

  while (leftIdx < leftFiltered.length || rightIdx < rightFiltered.length) {
    if (lcsIdx < lcs.length) {
      const match = lcs[lcsIdx];

      while (leftIdx < match.leftIndex) {
        result.push({
          type: 'deleted',
          leftLine: leftFiltered[leftIdx],
          leftLineNum: leftMapping[leftIdx] + 1,
          rightLine: null,
          rightLineNum: null,
        });
        leftIdx++;
      }

      while (rightIdx < match.rightIndex) {
        result.push({
          type: 'added',
          leftLine: null,
          leftLineNum: null,
          rightLine: rightFiltered[rightIdx],
          rightLineNum: rightMapping[rightIdx] + 1,
        });
        rightIdx++;
      }

      result.push({
        type: 'unchanged',
        leftLine: leftFiltered[leftIdx],
        leftLineNum: leftMapping[leftIdx] + 1,
        rightLine: rightFiltered[rightIdx],
        rightLineNum: rightMapping[rightIdx] + 1,
      });
      leftIdx++;
      rightIdx++;
      lcsIdx++;
    } else {
      while (leftIdx < leftFiltered.length) {
        result.push({
          type: 'deleted',
          leftLine: leftFiltered[leftIdx],
          leftLineNum: leftMapping[leftIdx] + 1,
          rightLine: null,
          rightLineNum: null,
        });
        leftIdx++;
      }

      while (rightIdx < rightFiltered.length) {
        result.push({
          type: 'added',
          leftLine: null,
          leftLineNum: null,
          rightLine: rightFiltered[rightIdx],
          rightLineNum: rightMapping[rightIdx] + 1,
        });
        rightIdx++;
      }
    }
  }

  // Merge adjacent delete/add pairs into modified
  // First, find consecutive groups of deletes followed by adds
  const merged = [];
  let i = 0;
  while (i < result.length) {
    if (result[i].type === 'deleted') {
      // Collect all consecutive deletes
      const deletes = [];
      while (i < result.length && result[i].type === 'deleted') {
        deletes.push(result[i]);
        i++;
      }

      // Collect all consecutive adds that follow
      const adds = [];
      while (i < result.length && result[i].type === 'added') {
        adds.push(result[i]);
        i++;
      }

      // If we have both deletes and adds, merge them as modified
      if (deletes.length > 0 && adds.length > 0) {
        const maxLen = Math.max(deletes.length, adds.length);
        for (let j = 0; j < maxLen; j++) {
          if (j < deletes.length && j < adds.length) {
            merged.push({
              type: 'modified',
              leftLine: deletes[j].leftLine,
              leftLineNum: deletes[j].leftLineNum,
              rightLine: adds[j].rightLine,
              rightLineNum: adds[j].rightLineNum,
            });
          } else if (j < deletes.length) {
            merged.push(deletes[j]);
          } else {
            merged.push(adds[j]);
          }
        }
      } else {
        // No adds followed, just push the deletes
        merged.push(...deletes);
      }
    } else if (result[i].type === 'added') {
      // Standalone adds (not preceded by deletes)
      merged.push(result[i]);
      i++;
    } else {
      // Unchanged lines
      merged.push(result[i]);
      i++;
    }
  }

  return merged;
}

// Get line decorations for Monaco editor
function getLineDecorations(diff, side) {
  const decorations = [];

  diff.forEach((entry) => {
    const lineNum = side === 'left' ? entry.leftLineNum : entry.rightLineNum;
    if (lineNum === null) return;

    let className = '';
    let glyphClassName = '';

    if (entry.type === 'deleted' && side === 'left') {
      className = 'diff-line-deleted';
      glyphClassName = 'diff-glyph-deleted';
    } else if (entry.type === 'added' && side === 'right') {
      className = 'diff-line-added';
      glyphClassName = 'diff-glyph-added';
    } else if (entry.type === 'modified') {
      className = 'diff-line-modified';
      glyphClassName = 'diff-glyph-modified';
    }

    if (className) {
      decorations.push({
        range: { startLineNumber: lineNum, startColumn: 1, endLineNumber: lineNum, endColumn: 1 },
        options: {
          isWholeLine: true,
          className,
          glyphMarginClassName: glyphClassName,
        },
      });
    }
  });

  return decorations;
}

// Compute view zones (grey placeholder lines) for missing code
// Returns an array of objects with afterLineNumber and count of placeholder lines
function computeViewZones(diff, side) {
  const zones = [];
  let currentLineNum = 0; // Track current line number in the file
  let pendingPlaceholders = 0; // Count consecutive placeholders to merge

  diff.forEach((entry, index) => {
    const hasLineOnThisSide = side === 'left' ? entry.leftLineNum !== null : entry.rightLineNum !== null;
    const hasLineOnOtherSide = side === 'left' ? entry.rightLineNum !== null : entry.leftLineNum !== null;

    if (hasLineOnThisSide) {
      // This side has a line
      // First, flush any pending placeholders before this line
      if (pendingPlaceholders > 0) {
        zones.push({
          afterLineNumber: currentLineNum,
          heightInLines: pendingPlaceholders,
        });
        pendingPlaceholders = 0;
      }
      currentLineNum = side === 'left' ? entry.leftLineNum : entry.rightLineNum;
    } else if (hasLineOnOtherSide) {
      // Other side has a line but this side doesn't - need a placeholder
      pendingPlaceholders++;
    }
  });

  // Flush any remaining placeholders at the end
  if (pendingPlaceholders > 0) {
    zones.push({
      afterLineNumber: currentLineNum,
      heightInLines: pendingPlaceholders,
    });
  }

  return zones;
}

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

function detectLanguage(code) {
  if (!code) return { monaco: 'plaintext', prettier: 'babel' };

  const patterns = [
    { regex: /^\s*import\s+.*from\s+['"]|^\s*export\s+(default\s+)?(function|class|const|let|var)|^\s*const\s+\w+\s*=\s*require\(/m, monaco: 'javascript', prettier: 'babel' },
    { regex: /^\s*interface\s+\w+|^\s*type\s+\w+\s*=|:\s*(string|number|boolean|any)\b/m, monaco: 'typescript', prettier: 'typescript' },
    { regex: /^\s*<(!DOCTYPE\s+html|html|head|body|div|span|p|a\s)/im, monaco: 'html', prettier: 'html' },
    { regex: /^\s*(@import|@media|@keyframes|\.[a-z][\w-]*\s*\{|#[a-z][\w-]*\s*\{)/m, monaco: 'css', prettier: 'css' },
    { regex: /^\s*\{[\s\S]*"[\w]+"\s*:/m, monaco: 'json', prettier: 'json' },
    { regex: /^\s*(def\s+\w+|class\s+\w+.*:|import\s+\w+|from\s+\w+\s+import)/m, monaco: 'python', prettier: null },
    { regex: /^\s*(package\s+\w+|func\s+\w+|import\s+")/m, monaco: 'go', prettier: null },
    { regex: /^\s*(fn\s+\w+|let\s+mut\s+|use\s+\w+::)/m, monaco: 'rust', prettier: null },
    { regex: /^\s*(public\s+class|private\s+class|package\s+\w+;)/m, monaco: 'java', prettier: null },
    { regex: /^\s*(#include|int\s+main|void\s+\w+\s*\()/m, monaco: 'cpp', prettier: null },
    { regex: /^\s*---\s*\n|^\s*[\w-]+:\s*.+/m, monaco: 'yaml', prettier: 'yaml' },
    { regex: /^\s*(query|mutation|subscription|type\s+\w+)\s*\{/m, monaco: 'graphql', prettier: 'graphql' },
    { regex: /^\s*(#\s+|##\s+|\*\*\w+\*\*|\[.+\]\(.+\))/m, monaco: 'markdown', prettier: 'markdown' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(code)) {
      return { monaco: pattern.monaco, prettier: pattern.prettier };
    }
  }

  return { monaco: 'plaintext', prettier: 'babel' };
}

// ============================================================================
// PRETTIER FORMATTING
// ============================================================================

async function formatCode(code, language) {
  if (!language) return code;

  const plugins = [];

  try {
    if (['babel', 'javascript', 'typescript'].includes(language)) {
      const babelPlugin = await import('prettier/plugins/babel');
      const estreePlugin = await import('prettier/plugins/estree');
      plugins.push(babelPlugin.default, estreePlugin.default);
    } else if (language === 'html') {
      const htmlPlugin = await import('prettier/plugins/html');
      plugins.push(htmlPlugin.default);
    } else if (language === 'css') {
      const cssPlugin = await import('prettier/plugins/postcss');
      plugins.push(cssPlugin.default);
    } else if (language === 'markdown') {
      const mdPlugin = await import('prettier/plugins/markdown');
      plugins.push(mdPlugin.default);
    } else if (language === 'yaml') {
      const yamlPlugin = await import('prettier/plugins/yaml');
      plugins.push(yamlPlugin.default);
    } else if (language === 'graphql') {
      const graphqlPlugin = await import('prettier/plugins/graphql');
      plugins.push(graphqlPlugin.default);
    } else if (language === 'json') {
      const babelPlugin = await import('prettier/plugins/babel');
      const estreePlugin = await import('prettier/plugins/estree');
      plugins.push(babelPlugin.default, estreePlugin.default);
    }

    const parser = language === 'javascript' ? 'babel' : language === 'json' ? 'json' : language;

    return await prettier.format(code, {
      parser,
      plugins,
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5',
      printWidth: 80,
    });
  } catch (error) {
    console.error('Prettier formatting error:', error);
    throw error;
  }
}

// ============================================================================
// PATCH GENERATION
// ============================================================================

function generateUnifiedPatch(leftCode, rightCode, leftFileName = 'original', rightFileName = 'modified') {
  const leftLines = leftCode.split('\n');
  const rightLines = rightCode.split('\n');
  const diff = computeLineDiff(leftLines, rightLines);

  const lines = [];
  lines.push(`--- ${leftFileName}`);
  lines.push(`+++ ${rightFileName}`);

  let leftLineNum = 1;
  let rightLineNum = 1;
  let currentHunk = [];
  let hunkLeftStart = 0;
  let hunkRightStart = 0;
  let hunkLeftCount = 0;
  let hunkRightCount = 0;

  const flushHunk = () => {
    if (currentHunk.length > 0) {
      lines.push(`@@ -${hunkLeftStart},${hunkLeftCount} +${hunkRightStart},${hunkRightCount} @@`);
      lines.push(...currentHunk);
      currentHunk = [];
    }
  };

  for (const entry of diff) {
    if (entry.type === 'unchanged') {
      if (currentHunk.length > 0) {
        currentHunk.push(` ${entry.leftLine}`);
        hunkLeftCount++;
        hunkRightCount++;
      }
      leftLineNum++;
      rightLineNum++;
    } else {
      if (currentHunk.length === 0) {
        hunkLeftStart = entry.leftLineNum || leftLineNum;
        hunkRightStart = entry.rightLineNum || rightLineNum;
        hunkLeftCount = 0;
        hunkRightCount = 0;
      }

      if (entry.type === 'deleted') {
        currentHunk.push(`-${entry.leftLine}`);
        hunkLeftCount++;
        leftLineNum++;
      } else if (entry.type === 'added') {
        currentHunk.push(`+${entry.rightLine}`);
        hunkRightCount++;
        rightLineNum++;
      } else if (entry.type === 'modified') {
        currentHunk.push(`-${entry.leftLine}`);
        currentHunk.push(`+${entry.rightLine}`);
        hunkLeftCount++;
        hunkRightCount++;
        leftLineNum++;
        rightLineNum++;
      }
    }
  }

  flushHunk();
  return lines.join('\n');
}

function generateHTMLReport(leftCode, rightCode, diff, stats) {
  const escapeHtml = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const diffRows = diff.map((entry) => {
    const leftClass = entry.type === 'deleted' || entry.type === 'modified' ? `diff-${entry.type}` : '';
    const rightClass = entry.type === 'added' || entry.type === 'modified' ? `diff-${entry.type}` : '';

    return `
      <tr>
        <td class="line-num">${entry.leftLineNum || ''}</td>
        <td class="code ${leftClass}">${escapeHtml(entry.leftLine) || ''}</td>
        <td class="line-num">${entry.rightLineNum || ''}</td>
        <td class="code ${rightClass}">${escapeHtml(entry.rightLine) || ''}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>WebMerge Diff Report</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; margin: 20px; background: #1e1e1e; color: #d4d4d4; }
    h1 { color: #fff; }
    .stats { margin: 20px 0; padding: 15px; background: #2d2d2d; border-radius: 8px; }
    .stats span { margin-right: 20px; }
    .added-stat { color: #85e89d; }
    .deleted-stat { color: #f97583; }
    .modified-stat { color: #ffea7f; }
    table { width: 100%; border-collapse: collapse; font-family: 'Fira Code', monospace; font-size: 13px; }
    th, td { border: 1px solid #333; padding: 4px 8px; text-align: left; }
    th { background: #2d2d2d; }
    .line-num { width: 50px; text-align: right; color: #6e7681; background: #1e1e1e; }
    .code { white-space: pre; }
    .diff-deleted { background: rgba(248, 81, 73, 0.15); }
    .diff-added { background: rgba(46, 160, 67, 0.15); }
    .diff-modified { background: rgba(187, 128, 9, 0.15); }
  </style>
</head>
<body>
  <h1>WebMerge Diff Report</h1>
  <div class="stats">
    <span class="added-stat">+${stats.added} added</span>
    <span class="deleted-stat">-${stats.deleted} deleted</span>
    <span class="modified-stat">~${stats.modified} modified</span>
    <span>${stats.unchanged} unchanged</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Line</th>
        <th>Original</th>
        <th>Line</th>
        <th>Modified</th>
      </tr>
    </thead>
    <tbody>
      ${diffRows}
    </tbody>
  </table>
</body>
</html>
  `.trim();
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Stats component
const DiffStats = ({ stats }) => (
  <div className="flex items-center gap-4 text-sm">
    <span className="text-green-400">+{stats.added} added</span>
    <span className="text-red-400">-{stats.deleted} deleted</span>
    <span className="text-yellow-400">~{stats.modified} modified</span>
    <span className="text-gray-400">{stats.unchanged} unchanged</span>
  </div>
);

// Minimap component showing diff locations
const Minimap = ({ diff, onJumpTo, currentDiffIndex, diffIndices }) => {
  const markers = useMemo(() => {
    if (!diff.length) return [];

    return diff.map((entry, index) => {
      if (entry.type === 'unchanged') return null;
      const top = (index / diff.length) * 100;
      return {
        index,
        top,
        type: entry.type,
        isActive: diffIndices[currentDiffIndex] === index,
      };
    }).filter(Boolean);
  }, [diff, currentDiffIndex, diffIndices]);

  return (
    <div className="w-16 bg-gray-800 border-l border-gray-700 relative flex-shrink-0">
      <div className="absolute inset-0 overflow-hidden">
        {markers.map((marker, i) => (
          <div
            key={i}
            className={`absolute left-1 right-1 cursor-pointer transition-all ${
              marker.isActive ? 'ring-2 ring-white' : ''
            }`}
            style={{
              top: `${marker.top}%`,
              height: '3px',
              backgroundColor:
                marker.type === 'added' ? '#2ea043' :
                marker.type === 'deleted' ? '#f85149' :
                '#bb8009',
            }}
            onClick={() => onJumpTo(marker.index)}
            title={`${marker.type} - Line ${marker.index + 1}`}
          />
        ))}
      </div>
      <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-gray-500">
        Map
      </div>
    </div>
  );
};

// Options Panel component
const OptionsPanel = ({ options, onChange }) => (
  <div className="flex items-center gap-4 text-sm">
    <label className="flex items-center gap-1 cursor-pointer hover:text-white">
      <input
        type="checkbox"
        checked={options.ignoreWhitespace}
        onChange={(e) => onChange({ ...options, ignoreWhitespace: e.target.checked })}
        className="rounded bg-gray-700 border-gray-600"
      />
      Ignore whitespace
    </label>
    <label className="flex items-center gap-1 cursor-pointer hover:text-white">
      <input
        type="checkbox"
        checked={options.ignoreCase}
        onChange={(e) => onChange({ ...options, ignoreCase: e.target.checked })}
        className="rounded bg-gray-700 border-gray-600"
      />
      Ignore case
    </label>
    <label className="flex items-center gap-1 cursor-pointer hover:text-white">
      <input
        type="checkbox"
        checked={options.ignoreBlankLines}
        onChange={(e) => onChange({ ...options, ignoreBlankLines: e.target.checked })}
        className="rounded bg-gray-700 border-gray-600"
      />
      Ignore blank lines
    </label>
  </div>
);

// Side-by-side Editor Panel with diff highlighting
const DiffEditorPanel = ({
  title,
  titleColor,
  code,
  onChange,
  language,
  decorations,
  viewZones,
  onFormat,
  isFormatting,
  onDrop,
  editorRef,
  onScroll,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const decorationIds = useRef([]);
  const viewZoneIds = useRef([]);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;

    // Apply decorations
    decorationIds.current = editor.deltaDecorations([], decorations);

    // Apply view zones (grey placeholder lines)
    applyViewZones(editor, viewZones);

    // Sync scroll
    editor.onDidScrollChange((e) => {
      if (onScroll) {
        onScroll(e.scrollTop);
      }
    });
  };

  // Function to apply view zones
  const applyViewZones = useCallback((editor, zones) => {
    editor.changeViewZones((accessor) => {
      // Remove existing view zones
      viewZoneIds.current.forEach((id) => accessor.removeZone(id));
      viewZoneIds.current = [];

      // Add new view zones
      zones.forEach((zone) => {
        const domNode = document.createElement('div');
        domNode.style.background = '#2d2d2d';
        domNode.style.width = '100%';
        // Add a subtle pattern or indicator that this is a placeholder
        domNode.style.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 20px)';

        const id = accessor.addZone({
          afterLineNumber: zone.afterLineNumber,
          heightInLines: zone.heightInLines,
          domNode,
        });
        viewZoneIds.current.push(id);
      });
    });
  }, []);

  // Update decorations when they change
  useEffect(() => {
    if (editorRef.current) {
      decorationIds.current = editorRef.current.deltaDecorations(
        decorationIds.current,
        decorations
      );
    }
  }, [decorations]);

  // Update view zones when they change
  useEffect(() => {
    if (editorRef.current) {
      applyViewZones(editorRef.current, viewZones);
    }
  }, [viewZones, applyViewZones]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onDrop(file);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col relative border border-gray-700 rounded-lg overflow-hidden min-w-0"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="bg-gray-800 px-3 py-2 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${titleColor}`}>{title}</span>
          <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
            {language}
          </span>
        </div>
        <button
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors flex items-center gap-1"
          onClick={onFormat}
          disabled={isFormatting}
        >
          {isFormatting ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Formatting...
            </>
          ) : (
            'Format'
          )}
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={onChange}
          theme="vs-dark"
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'Fira Code', Monaco, Consolas, monospace",
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'off',
            renderWhitespace: 'selection',
            glyphMargin: true,
            folding: true,
            lineDecorationsWidth: 5,
          }}
        />
      </div>
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10">
          <span className="text-blue-400 text-lg font-medium">Drop file here</span>
        </div>
      )}
    </div>
  );
};

// Center merge buttons between panels
const MergeButtons = ({ onCopyAllToRight, onCopyAllToLeft }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-2 flex-shrink-0">
    <button
      className="w-8 h-8 bg-gray-700 hover:bg-blue-600 rounded flex items-center justify-center transition-colors"
      onClick={onCopyAllToRight}
      title="Copy all to right"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </button>
    <button
      className="w-8 h-8 bg-gray-700 hover:bg-blue-600 rounded flex items-center justify-center transition-colors"
      onClick={onCopyAllToLeft}
      title="Copy all to left"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
      </svg>
    </button>
  </div>
);

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  const monaco = useMonaco();

  // State
  const [leftCode, setLeftCode] = useState(`// Original code
function greet(name) {
  console.log("Hello, " + name);
}

function add(a, b) {
  return a + b;
}

const result = add(1, 2);
console.log(result);`);

  const [rightCode, setRightCode] = useState(`// Modified code
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

function add(a, b, c = 0) {
  return a + b + c;
}

function subtract(a, b) {
  return a - b;
}

const result = add(1, 2, 3);
console.log(result);`);

  const [options, setOptions] = useState({
    ignoreWhitespace: false,
    ignoreCase: false,
    ignoreBlankLines: false,
  });

  const [isFormatting, setIsFormatting] = useState({ left: false, right: false });
  const [currentDiffIndex, setCurrentDiffIndex] = useState(-1);

  const leftEditorRef = useRef(null);
  const rightEditorRef = useRef(null);
  const isScrolling = useRef(false);

  // Define custom CSS for decorations
  useEffect(() => {
    if (monaco) {
      // Create custom CSS rules for diff highlighting
      const style = document.createElement('style');
      style.textContent = `
        .diff-line-deleted {
          background: rgba(248, 81, 73, 0.2) !important;
        }
        .diff-line-added {
          background: rgba(46, 160, 67, 0.2) !important;
        }
        .diff-line-modified {
          background: rgba(187, 128, 9, 0.2) !important;
        }
        .diff-glyph-deleted {
          background: #f85149;
          width: 4px !important;
          margin-left: 3px;
        }
        .diff-glyph-added {
          background: #2ea043;
          width: 4px !important;
          margin-left: 3px;
        }
        .diff-glyph-modified {
          background: #bb8009;
          width: 4px !important;
          margin-left: 3px;
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.head.removeChild(style);
      };
    }
  }, [monaco]);

  // Detect language
  const leftLanguage = useMemo(() => detectLanguage(leftCode), [leftCode]);
  const rightLanguage = useMemo(() => detectLanguage(rightCode), [rightCode]);

  // Compute diff
  const diff = useMemo(() => {
    const leftLines = leftCode.split('\n');
    const rightLines = rightCode.split('\n');
    return computeLineDiff(leftLines, rightLines, options);
  }, [leftCode, rightCode, options]);

  // Compute stats
  const stats = useMemo(() => {
    return diff.reduce(
      (acc, entry) => {
        acc[entry.type]++;
        return acc;
      },
      { added: 0, deleted: 0, modified: 0, unchanged: 0 }
    );
  }, [diff]);

  // Get diff indices
  const diffIndices = useMemo(() => {
    return diff
      .map((entry, index) => (entry.type !== 'unchanged' ? index : null))
      .filter((i) => i !== null);
  }, [diff]);

  // Get decorations for each side
  const leftDecorations = useMemo(() => getLineDecorations(diff, 'left'), [diff]);
  const rightDecorations = useMemo(() => getLineDecorations(diff, 'right'), [diff]);

  // Get view zones (placeholder lines) for each side
  const leftViewZones = useMemo(() => computeViewZones(diff, 'left'), [diff]);
  const rightViewZones = useMemo(() => computeViewZones(diff, 'right'), [diff]);

  // Synchronized scrolling
  const handleLeftScroll = useCallback((scrollTop) => {
    if (isScrolling.current) return;
    isScrolling.current = true;
    if (rightEditorRef.current) {
      rightEditorRef.current.setScrollTop(scrollTop);
    }
    requestAnimationFrame(() => {
      isScrolling.current = false;
    });
  }, []);

  const handleRightScroll = useCallback((scrollTop) => {
    if (isScrolling.current) return;
    isScrolling.current = true;
    if (leftEditorRef.current) {
      leftEditorRef.current.setScrollTop(scrollTop);
    }
    requestAnimationFrame(() => {
      isScrolling.current = false;
    });
  }, []);

  // Format code
  const handleFormat = async (side) => {
    const code = side === 'left' ? leftCode : rightCode;
    const lang = side === 'left' ? leftLanguage.prettier : rightLanguage.prettier;

    if (!lang) {
      alert('Formatting not supported for this language');
      return;
    }

    setIsFormatting((prev) => ({ ...prev, [side]: true }));
    try {
      const formatted = await formatCode(code, lang);
      if (side === 'left') setLeftCode(formatted);
      else setRightCode(formatted);
    } catch (error) {
      alert(`Formatting error: ${error.message}`);
    } finally {
      setIsFormatting((prev) => ({ ...prev, [side]: false }));
    }
  };

  // File handling
  const handleFileDrop = (file, side) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (side === 'left') setLeftCode(content);
      else setRightCode(content);
    };
    reader.readAsText(file);
  };

  // Navigation
  const goToNextDiff = useCallback(() => {
    if (diffIndices.length === 0) return;
    const nextIndex = (currentDiffIndex + 1) % diffIndices.length;
    setCurrentDiffIndex(nextIndex);
    scrollToDiff(nextIndex);
  }, [diffIndices, currentDiffIndex]);

  const goToPrevDiff = useCallback(() => {
    if (diffIndices.length === 0) return;
    const prevIndex = (currentDiffIndex - 1 + diffIndices.length) % diffIndices.length;
    setCurrentDiffIndex(prevIndex);
    scrollToDiff(prevIndex);
  }, [diffIndices, currentDiffIndex]);

  const scrollToDiff = useCallback((index) => {
    const lineIndex = diffIndices[index];
    if (lineIndex === undefined) return;

    const entry = diff[lineIndex];
    const leftLine = entry.leftLineNum || 1;
    const rightLine = entry.rightLineNum || 1;

    if (leftEditorRef.current) {
      leftEditorRef.current.revealLineInCenter(leftLine);
    }
    if (rightEditorRef.current) {
      rightEditorRef.current.revealLineInCenter(rightLine);
    }
  }, [diff, diffIndices]);

  const jumpToDiff = useCallback((lineIndex) => {
    const diffIdx = diffIndices.indexOf(lineIndex);
    if (diffIdx !== -1) {
      setCurrentDiffIndex(diffIdx);
      scrollToDiff(diffIdx);
    } else {
      const nearest = diffIndices.reduce((prev, curr) =>
        Math.abs(curr - lineIndex) < Math.abs(prev - lineIndex) ? curr : prev
      , diffIndices[0]);
      const nearestIdx = diffIndices.indexOf(nearest);
      setCurrentDiffIndex(nearestIdx);
      scrollToDiff(nearestIdx);
    }
  }, [diffIndices, scrollToDiff]);

  // Copy operations
  const handleCopyAllToRight = () => {
    setRightCode(leftCode);
  };

  const handleCopyAllToLeft = () => {
    setLeftCode(rightCode);
  };

  // Swap sides
  const handleSwap = () => {
    const temp = leftCode;
    setLeftCode(rightCode);
    setRightCode(temp);
  };

  // Clear all
  const handleClear = () => {
    setLeftCode('');
    setRightCode('');
    setCurrentDiffIndex(-1);
  };

  // Export functions
  const exportPatch = () => {
    const patch = generateUnifiedPatch(leftCode, rightCode);
    const blob = new Blob([patch], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diff.patch';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportHTML = () => {
    const html = generateHTMLReport(leftCode, rightCode, diff, stats);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diff-report.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyDiffToClipboard = () => {
    const patch = generateUnifiedPatch(leftCode, rightCode);
    navigator.clipboard.writeText(patch);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMod = e.ctrlKey || e.metaKey;

      if (e.key === 'F8' || (isMod && e.key === 'd')) {
        e.preventDefault();
        if (e.shiftKey) goToPrevDiff();
        else goToNextDiff();
      } else if (isMod && e.key === 'g') {
        e.preventDefault();
        const line = prompt('Go to line:');
        if (line) {
          const lineNum = parseInt(line, 10);
          if (!isNaN(lineNum)) {
            jumpToDiff(lineNum - 1);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextDiff, goToPrevDiff, jumpToDiff]);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-blue-400">WebMerge</h1>
            <DiffStats stats={stats} />
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors" onClick={handleSwap}>
              Swap
            </button>
            <button className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors" onClick={handleClear}>
              Clear
            </button>
            <div className="h-4 w-px bg-gray-600" />
            <button className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors" onClick={exportPatch}>
              Export Patch
            </button>
            <button className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors" onClick={exportHTML}>
              Export HTML
            </button>
            <button className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors" onClick={copyDiffToClipboard}>
              Copy Diff
            </button>
          </div>
        </div>
      </header>

      {/* Options bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <OptionsPanel options={options} onChange={setOptions} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            Difference {diffIndices.length > 0 ? currentDiffIndex + 1 : 0} of {diffIndices.length}
          </span>
          <button
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={goToPrevDiff}
            disabled={diffIndices.length === 0}
          >
            Prev
          </button>
          <button
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={goToNextDiff}
            disabled={diffIndices.length === 0}
          >
            Next
          </button>
        </div>
      </div>

      {/* Main content - Side by side editors */}
      <div className="flex-1 flex overflow-hidden p-4 gap-0 min-h-0">
        {/* Left Editor (Original) */}
        <DiffEditorPanel
          title="Original"
          titleColor="text-red-400"
          code={leftCode}
          onChange={setLeftCode}
          language={leftLanguage.monaco}
          decorations={leftDecorations}
          viewZones={leftViewZones}
          onFormat={() => handleFormat('left')}
          isFormatting={isFormatting.left}
          onDrop={(file) => handleFileDrop(file, 'left')}
          editorRef={leftEditorRef}
          onScroll={handleLeftScroll}
        />

        {/* Merge buttons */}
        <MergeButtons
          onCopyAllToRight={handleCopyAllToRight}
          onCopyAllToLeft={handleCopyAllToLeft}
        />

        {/* Right Editor (Modified) */}
        <DiffEditorPanel
          title="Modified"
          titleColor="text-green-400"
          code={rightCode}
          onChange={setRightCode}
          language={rightLanguage.monaco}
          decorations={rightDecorations}
          viewZones={rightViewZones}
          onFormat={() => handleFormat('right')}
          isFormatting={isFormatting.right}
          onDrop={(file) => handleFileDrop(file, 'right')}
          editorRef={rightEditorRef}
          onScroll={handleRightScroll}
        />

        {/* Minimap */}
        <Minimap
          diff={diff}
          onJumpTo={jumpToDiff}
          currentDiffIndex={currentDiffIndex}
          diffIndices={diffIndices}
        />
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-sm text-gray-400 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span>
            Shortcuts: F8/Ctrl+D (Next diff) | Shift+F8 (Prev diff) | Ctrl+G (Go to line)
          </span>
          <span>
            Drag & drop files into editors | Use arrows to copy between panels
          </span>
        </div>
      </footer>
    </div>
  );
}
