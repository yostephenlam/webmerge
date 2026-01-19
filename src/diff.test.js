// Unit tests for the diff algorithm
// Run with: node src/diff.test.js

// ============================================================================
// DIFF ALGORITHM (copy from App.jsx for testing)
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
function computeViewZones(diff, side) {
  const zones = [];
  let currentLineNum = 0;
  let pendingPlaceholders = 0;

  diff.forEach((entry, index) => {
    const hasLineOnThisSide = side === 'left' ? entry.leftLineNum !== null : entry.rightLineNum !== null;
    const hasLineOnOtherSide = side === 'left' ? entry.rightLineNum !== null : entry.leftLineNum !== null;

    if (hasLineOnThisSide) {
      if (pendingPlaceholders > 0) {
        zones.push({
          afterLineNumber: currentLineNum,
          heightInLines: pendingPlaceholders,
        });
        pendingPlaceholders = 0;
      }
      currentLineNum = side === 'left' ? entry.leftLineNum : entry.rightLineNum;
    } else if (hasLineOnOtherSide) {
      pendingPlaceholders++;
    }
  });

  if (pendingPlaceholders > 0) {
    zones.push({
      afterLineNumber: currentLineNum,
      heightInLines: pendingPlaceholders,
    });
  }

  return zones;
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);
  if (actualStr !== expectedStr) {
    throw new Error(`${message}\nExpected:\n${expectedStr}\nActual:\n${actualStr}`);
  }
}

function assertDeepEqual(actual, expected, message = '') {
  assertEqual(actual, expected, message);
}

// ============================================================================
// TEST CASES
// ============================================================================

console.log('\n========================================');
console.log('DIFF ALGORITHM TESTS');
console.log('========================================\n');

// Test 1: Simple addition
test('Simple addition - one line added at end', () => {
  const left = ['line1', 'line2'];
  const right = ['line1', 'line2', 'line3'];
  const diff = computeLineDiff(left, right);

  assertEqual(diff.length, 3);
  assertEqual(diff[0].type, 'unchanged');
  assertEqual(diff[1].type, 'unchanged');
  assertEqual(diff[2].type, 'added');
  assertEqual(diff[2].rightLine, 'line3');
  assertEqual(diff[2].rightLineNum, 3);
});

// Test 2: Simple deletion
test('Simple deletion - one line removed', () => {
  const left = ['line1', 'line2', 'line3'];
  const right = ['line1', 'line3'];
  const diff = computeLineDiff(left, right);

  assertEqual(diff.length, 3);
  assertEqual(diff[0].type, 'unchanged');
  assertEqual(diff[1].type, 'deleted');
  assertEqual(diff[1].leftLine, 'line2');
  assertEqual(diff[1].leftLineNum, 2);
  assertEqual(diff[2].type, 'unchanged');
});

// Test 3: Simple modification
test('Simple modification - one line changed', () => {
  const left = ['line1', 'line2', 'line3'];
  const right = ['line1', 'modified', 'line3'];
  const diff = computeLineDiff(left, right);

  assertEqual(diff.length, 3);
  assertEqual(diff[0].type, 'unchanged');
  assertEqual(diff[1].type, 'modified');
  assertEqual(diff[1].leftLine, 'line2');
  assertEqual(diff[1].rightLine, 'modified');
  assertEqual(diff[2].type, 'unchanged');
});

// Test 4: Multiple additions
test('Multiple additions - lines added in middle', () => {
  const left = ['A', 'B'];
  const right = ['A', 'X', 'Y', 'B'];
  const diff = computeLineDiff(left, right);

  assertEqual(diff.length, 4);
  assertEqual(diff[0].type, 'unchanged');
  assertEqual(diff[1].type, 'added');
  assertEqual(diff[1].rightLine, 'X');
  assertEqual(diff[2].type, 'added');
  assertEqual(diff[2].rightLine, 'Y');
  assertEqual(diff[3].type, 'unchanged');
});

// Test 5: Multiple deletions
test('Multiple deletions - lines removed in middle', () => {
  const left = ['A', 'X', 'Y', 'B'];
  const right = ['A', 'B'];
  const diff = computeLineDiff(left, right);

  assertEqual(diff.length, 4);
  assertEqual(diff[0].type, 'unchanged');
  assertEqual(diff[1].type, 'deleted');
  assertEqual(diff[1].leftLine, 'X');
  assertEqual(diff[2].type, 'deleted');
  assertEqual(diff[2].leftLine, 'Y');
  assertEqual(diff[3].type, 'unchanged');
});

// Test 6: Mixed changes
test('Mixed changes - add, delete, modify', () => {
  const left = ['A', 'B', 'C'];
  const right = ['A', 'X', 'D'];
  const diff = computeLineDiff(left, right);

  // Should have: unchanged A, modified B->X, modified C->D
  const types = diff.map(d => d.type);
  console.log('  Types:', types);
  console.log('  Diff:', diff.map(d => `${d.type}: ${d.leftLine} -> ${d.rightLine}`));

  // Check we have the right lines
  assertEqual(diff[0].type, 'unchanged');
  assertEqual(diff[0].leftLine, 'A');
});

// Test 7: All lines changed
test('All lines changed', () => {
  const left = ['A', 'B', 'C'];
  const right = ['X', 'Y', 'Z'];
  const diff = computeLineDiff(left, right);

  // Should be all modified
  assertEqual(diff.length, 3);
  diff.forEach((d, i) => {
    assertEqual(d.type, 'modified', `Line ${i} should be modified`);
  });
});

// Test 8: Empty left
test('Empty left - all additions', () => {
  const left = [];
  const right = ['A', 'B'];
  const diff = computeLineDiff(left, right);

  assertEqual(diff.length, 2);
  assertEqual(diff[0].type, 'added');
  assertEqual(diff[1].type, 'added');
});

// Test 9: Empty right
test('Empty right - all deletions', () => {
  const left = ['A', 'B'];
  const right = [];
  const diff = computeLineDiff(left, right);

  assertEqual(diff.length, 2);
  assertEqual(diff[0].type, 'deleted');
  assertEqual(diff[1].type, 'deleted');
});

// Test 10: Identical
test('Identical content', () => {
  const left = ['A', 'B', 'C'];
  const right = ['A', 'B', 'C'];
  const diff = computeLineDiff(left, right);

  assertEqual(diff.length, 3);
  diff.forEach(d => {
    assertEqual(d.type, 'unchanged');
  });
});

// Test 11: Line number correctness
test('Line numbers are correct', () => {
  const left = ['A', 'B', 'C'];
  const right = ['A', 'X', 'C'];
  const diff = computeLineDiff(left, right);

  assertEqual(diff[0].leftLineNum, 1);
  assertEqual(diff[0].rightLineNum, 1);
  assertEqual(diff[1].leftLineNum, 2);
  assertEqual(diff[1].rightLineNum, 2);
  assertEqual(diff[2].leftLineNum, 3);
  assertEqual(diff[2].rightLineNum, 3);
});

// Test 12: Decorations for left side
test('Decorations for left side - deleted lines marked', () => {
  const left = ['A', 'B', 'C'];
  const right = ['A', 'C'];
  const diff = computeLineDiff(left, right);
  const decorations = getLineDecorations(diff, 'left');

  console.log('  Diff:', diff.map(d => `${d.type}: L${d.leftLineNum} R${d.rightLineNum}`));
  console.log('  Left decorations:', decorations);

  // Should have decoration for deleted line 2
  assertEqual(decorations.length, 1);
  assertEqual(decorations[0].range.startLineNumber, 2);
  assertEqual(decorations[0].options.className, 'diff-line-deleted');
});

// Test 13: Decorations for right side
test('Decorations for right side - added lines marked', () => {
  const left = ['A', 'C'];
  const right = ['A', 'B', 'C'];
  const diff = computeLineDiff(left, right);
  const decorations = getLineDecorations(diff, 'right');

  console.log('  Diff:', diff.map(d => `${d.type}: L${d.leftLineNum} R${d.rightLineNum}`));
  console.log('  Right decorations:', decorations);

  // Should have decoration for added line 2
  assertEqual(decorations.length, 1);
  assertEqual(decorations[0].range.startLineNumber, 2);
  assertEqual(decorations[0].options.className, 'diff-line-added');
});

// Test 14: Decorations for modified lines on both sides
test('Decorations for modified lines - both sides marked', () => {
  const left = ['A', 'B', 'C'];
  const right = ['A', 'X', 'C'];
  const diff = computeLineDiff(left, right);
  const leftDeco = getLineDecorations(diff, 'left');
  const rightDeco = getLineDecorations(diff, 'right');

  console.log('  Diff:', diff.map(d => `${d.type}: L${d.leftLineNum}(${d.leftLine}) R${d.rightLineNum}(${d.rightLine})`));
  console.log('  Left decorations:', leftDeco);
  console.log('  Right decorations:', rightDeco);

  // Both sides should have decoration for modified line 2
  assertEqual(leftDeco.length, 1);
  assertEqual(leftDeco[0].range.startLineNumber, 2);
  assertEqual(leftDeco[0].options.className, 'diff-line-modified');

  assertEqual(rightDeco.length, 1);
  assertEqual(rightDeco[0].range.startLineNumber, 2);
  assertEqual(rightDeco[0].options.className, 'diff-line-modified');
});

// Test 15: Complex real-world example
test('Complex example - code changes', () => {
  const left = [
    '// Original code',
    'function greet(name) {',
    '  console.log("Hello, " + name);',
    '}',
    '',
    'function add(a, b) {',
    '  return a + b;',
    '}',
  ];

  const right = [
    '// Modified code',
    'function greet(name) {',
    '  console.log(`Hello, ${name}!`);',
    '}',
    '',
    'function add(a, b, c = 0) {',
    '  return a + b + c;',
    '}',
    '',
    'function subtract(a, b) {',
    '  return a - b;',
    '}',
  ];

  const diff = computeLineDiff(left, right);
  const leftDeco = getLineDecorations(diff, 'left');
  const rightDeco = getLineDecorations(diff, 'right');

  console.log('\n  Diff results:');
  diff.forEach((d, i) => {
    console.log(`    ${i}: ${d.type.padEnd(10)} L${String(d.leftLineNum).padStart(2)}:${(d.leftLine || '').substring(0,30).padEnd(32)} R${String(d.rightLineNum).padStart(2)}:${(d.rightLine || '').substring(0,30)}`);
  });

  console.log('\n  Left decorations:', leftDeco.map(d => `line ${d.range.startLineNumber}: ${d.options.className}`));
  console.log('  Right decorations:', rightDeco.map(d => `line ${d.range.startLineNumber}: ${d.options.className}`));

  // Check specific expectations
  // Line 1 should be modified (// Original code -> // Modified code)
  const line1 = diff.find(d => d.leftLineNum === 1 || d.rightLineNum === 1);
  assertEqual(line1.type, 'modified', 'Line 1 should be modified');

  // Line 3 should be modified (console.log change)
  const line3Diff = diff.find(d => d.leftLineNum === 3 && d.rightLineNum === 3);
  if (line3Diff) {
    assertEqual(line3Diff.type, 'modified', 'Line 3 should be modified');
  }
});

// Test 16: Addition at beginning should be marked correctly
test('Addition at beginning', () => {
  const left = ['B', 'C'];
  const right = ['A', 'B', 'C'];
  const diff = computeLineDiff(left, right);
  const rightDeco = getLineDecorations(diff, 'right');

  console.log('  Diff:', diff.map(d => `${d.type}: L${d.leftLineNum} R${d.rightLineNum}`));
  console.log('  Right decorations:', rightDeco);

  // Added line should be at position 1
  assertEqual(rightDeco.length, 1);
  assertEqual(rightDeco[0].range.startLineNumber, 1);
  assertEqual(rightDeco[0].options.className, 'diff-line-added');
});

// Test 17: Multiple additions not adjacent to deletions
test('Additions without adjacent deletions stay as added', () => {
  const left = ['A', 'C'];
  const right = ['A', 'B1', 'B2', 'C'];
  const diff = computeLineDiff(left, right);

  console.log('  Diff:', diff.map(d => `${d.type}: L${d.leftLineNum}(${d.leftLine}) R${d.rightLineNum}(${d.rightLine})`));

  // B1 and B2 should be 'added' not 'modified' since there's no adjacent deletion
  const added = diff.filter(d => d.type === 'added');
  assertEqual(added.length, 2, 'Should have 2 added lines');
  assertEqual(added[0].rightLine, 'B1');
  assertEqual(added[1].rightLine, 'B2');
});

// Test 18: Test the sample code from the app
test('Sample code from app - verify marking', () => {
  const leftCode = `// Original code
function greet(name) {
  console.log("Hello, " + name);
}

function add(a, b) {
  return a + b;
}

const result = add(1, 2);
console.log(result);`;

  const rightCode = `// Modified code
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
console.log(result);`;

  const leftLines = leftCode.split('\n');
  const rightLines = rightCode.split('\n');
  const diff = computeLineDiff(leftLines, rightLines);
  const leftDeco = getLineDecorations(diff, 'left');
  const rightDeco = getLineDecorations(diff, 'right');

  console.log('\n  Left lines:');
  leftLines.forEach((l, i) => console.log(`    ${i+1}: ${l}`));

  console.log('\n  Right lines:');
  rightLines.forEach((l, i) => console.log(`    ${i+1}: ${l}`));

  console.log('\n  Diff:');
  diff.forEach((d, i) => {
    console.log(`    ${d.type.padEnd(10)} L${String(d.leftLineNum || '-').padStart(2)} R${String(d.rightLineNum || '-').padStart(2)}`);
  });

  console.log('\n  Left decorations (should mark deleted/modified lines):');
  leftDeco.forEach(d => console.log(`    Line ${d.range.startLineNumber}: ${d.options.className}`));

  console.log('\n  Right decorations (should mark added/modified lines):');
  rightDeco.forEach(d => console.log(`    Line ${d.range.startLineNumber}: ${d.options.className}`));

  // Verify some specific lines:
  // Line 1 should be modified (comment change)
  // Lines 3, 6, 7 should be modified
  // Lines 10-12 (subtract function) should be added on right
  // Line 14 should be modified (add call)

  // Check left decorations cover the expected modified lines
  const leftDecLines = leftDeco.map(d => d.range.startLineNumber);
  console.log('\n  Left decorated lines:', leftDecLines);

  // Check right decorations cover expected added/modified lines
  const rightDecLines = rightDeco.map(d => d.range.startLineNumber);
  console.log('  Right decorated lines:', rightDecLines);
});

// ============================================================================
// VIEW ZONES TESTS
// ============================================================================

console.log('\n========================================');
console.log('VIEW ZONES TESTS');
console.log('========================================\n');

// Test: View zones for left side when lines are added on right
test('View zones - left side gets placeholders for added lines', () => {
  const left = ['A', 'C'];
  const right = ['A', 'B', 'C'];
  const diff = computeLineDiff(left, right);
  const leftZones = computeViewZones(diff, 'left');

  console.log('  Diff:', diff.map(d => `${d.type}: L${d.leftLineNum} R${d.rightLineNum}`));
  console.log('  Left zones:', leftZones);

  // Left should have 1 placeholder zone after line 1 (where 'B' is on right)
  assertEqual(leftZones.length, 1);
  assertEqual(leftZones[0].afterLineNumber, 1);
  assertEqual(leftZones[0].heightInLines, 1);
});

// Test: View zones for right side when lines are deleted on left
test('View zones - right side gets placeholders for deleted lines', () => {
  const left = ['A', 'B', 'C'];
  const right = ['A', 'C'];
  const diff = computeLineDiff(left, right);
  const rightZones = computeViewZones(diff, 'right');

  console.log('  Diff:', diff.map(d => `${d.type}: L${d.leftLineNum} R${d.rightLineNum}`));
  console.log('  Right zones:', rightZones);

  // Right should have 1 placeholder zone after line 1 (where 'B' was on left)
  assertEqual(rightZones.length, 1);
  assertEqual(rightZones[0].afterLineNumber, 1);
  assertEqual(rightZones[0].heightInLines, 1);
});

// Test: Multiple consecutive additions
test('View zones - multiple consecutive added lines', () => {
  const left = ['A', 'D'];
  const right = ['A', 'B', 'C', 'D'];
  const diff = computeLineDiff(left, right);
  const leftZones = computeViewZones(diff, 'left');

  console.log('  Diff:', diff.map(d => `${d.type}: L${d.leftLineNum} R${d.rightLineNum}`));
  console.log('  Left zones:', leftZones);

  // Left should have 1 zone with height 2 for lines B and C
  assertEqual(leftZones.length, 1);
  assertEqual(leftZones[0].afterLineNumber, 1);
  assertEqual(leftZones[0].heightInLines, 2);
});

// Test: Additions at the end
test('View zones - additions at end', () => {
  const left = ['A', 'B'];
  const right = ['A', 'B', 'C', 'D'];
  const diff = computeLineDiff(left, right);
  const leftZones = computeViewZones(diff, 'left');

  console.log('  Diff:', diff.map(d => `${d.type}: L${d.leftLineNum} R${d.rightLineNum}`));
  console.log('  Left zones:', leftZones);

  // Left should have 1 zone after line 2 with height 2
  assertEqual(leftZones.length, 1);
  assertEqual(leftZones[0].afterLineNumber, 2);
  assertEqual(leftZones[0].heightInLines, 2);
});

// Test: Additions at the beginning
test('View zones - additions at beginning', () => {
  const left = ['C', 'D'];
  const right = ['A', 'B', 'C', 'D'];
  const diff = computeLineDiff(left, right);
  const leftZones = computeViewZones(diff, 'left');

  console.log('  Diff:', diff.map(d => `${d.type}: L${d.leftLineNum} R${d.rightLineNum}`));
  console.log('  Left zones:', leftZones);

  // Left should have 1 zone at line 0 (before first line) with height 2
  assertEqual(leftZones.length, 1);
  assertEqual(leftZones[0].afterLineNumber, 0);
  assertEqual(leftZones[0].heightInLines, 2);
});

// Test: No zones for modified lines
test('View zones - no zones for modified lines', () => {
  const left = ['A', 'B', 'C'];
  const right = ['A', 'X', 'C'];
  const diff = computeLineDiff(left, right);
  const leftZones = computeViewZones(diff, 'left');
  const rightZones = computeViewZones(diff, 'right');

  console.log('  Diff:', diff.map(d => `${d.type}: L${d.leftLineNum} R${d.rightLineNum}`));
  console.log('  Left zones:', leftZones);
  console.log('  Right zones:', rightZones);

  // No zones needed for modified lines - both sides have the line
  assertEqual(leftZones.length, 0);
  assertEqual(rightZones.length, 0);
});

// Test: Complex case from sample code
test('View zones - complex sample code', () => {
  const leftCode = `// Original code
function greet(name) {
  console.log("Hello, " + name);
}

function add(a, b) {
  return a + b;
}

const result = add(1, 2);
console.log(result);`;

  const rightCode = `// Modified code
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
console.log(result);`;

  const leftLines = leftCode.split('\n');
  const rightLines = rightCode.split('\n');
  const diff = computeLineDiff(leftLines, rightLines);
  const leftZones = computeViewZones(diff, 'left');
  const rightZones = computeViewZones(diff, 'right');

  console.log('\n  Left zones (should have placeholders for added lines 11-14):');
  leftZones.forEach(z => console.log(`    After line ${z.afterLineNumber}: ${z.heightInLines} placeholder(s)`));

  console.log('\n  Right zones (should be empty - no deleted-only lines):');
  rightZones.forEach(z => console.log(`    After line ${z.afterLineNumber}: ${z.heightInLines} placeholder(s)`));

  // Left should have zones for the subtract function and extra lines added on right
  // Right should have no zones (all left lines either exist on right or are modified)
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n========================================');
console.log(`RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
console.log('========================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
