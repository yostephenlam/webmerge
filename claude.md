# Project: Code Diff Tool (WinMerge-like)

## Project Overview
Build a professional code difference comparison tool similar to WinMerge using React. This tool will provide comprehensive file and code comparison capabilities with an intuitive visual interface. The tool named "WebMerge"

## Core Requirements

### Essential Features
1. **Side-by-side Code Display**
   - 2-column or 3-column comparison support (2-way and 3-way merge)
   - Line-by-line comparison with highlighted differences
   - Synchronized scrolling between panels
   - Line numbers display with optional margins

2. **Difference Detection & Visualization**
   - Additions (green), deletions (red), modifications (yellow/gold)
   - Inline differences within lines (word-level highlighting)
   - Difference blocks with visual markers
   - Location pane/minimap showing overall file differences
   - Align similar lines within difference blocks

3. **Manual Code Editing**
   - Full text editing capability in each panel
   - Undo/Redo support
   - Find and Replace functionality
   - Copy, cut, and paste operations
   - Auto-save or manual save options

4. **Syntax Highlighting**
   - Support for multiple programming languages (JavaScript, Python, Java, C++, HTML, CSS, etc.)
   - Syntax-aware color coding
   - Configurable color schemes

5. **Merge Operations**
   - Copy to left/right/middle functionality
   - Selective merging of differences
   - Merge conflict resolution support
   - Copy entire difference blocks or individual changes

6. **Code Formatting**
   - **Prettier integration for automatic code formatting**
   - Format buttons above or below each code panel
   - Auto-detect language (JS, CSS, HTML, JSON, TypeScript, etc.)
   - Show loading state when formatting
   - Apply formatting to one or both panels

### Advanced Features (WinMerge-inspired)

7. **Navigation & Control**
   - Navigate to next/previous difference
   - Jump to specific line number
   - Keyboard shortcuts for common operations
   - Tab switching with mouse wheel support
   - Bookmark support for marking important lines

8. **Comparison Options**
   - Ignore whitespace (all/leading/trailing/none)
   - Ignore line breaks (treat as spaces)
   - Ignore case sensitivity
   - Ignore blank lines
   - Ignore code comments
   - Break at whitespace or punctuation for better word-level diff

9. **Filter System**
   - File extension filters
   - Include/exclude patterns using regex
   - Custom filter expressions
   - Line filters to exclude certain patterns from comparison

10. **File Handling**
    - Drag and drop file support
    - Recent files list (MRU - Most Recently Used)
    - Read-only mode option
    - Binary file comparison support (hex view)
    - Automatic file reload on external changes

11. **View Options**
    - Show/hide identical lines
    - Show/hide line numbers
    - Show/hide whitespace characters
    - Adjustable difference context (number of identical lines around differences)
    - Word wrap toggle
    - Split view or unified view

12. **Report Generation**
    - Export comparison results as HTML report
    - Generate patch files (unified diff format, context diff, normal diff)
    - Summary statistics (number of differences, additions, deletions)

13. **Color Schemes & Themes**
    - Light and dark mode support
    - Customizable color schemes
    - Save custom color schemes
    - Pre-defined themes

14. **Performance Optimizations**
    - Efficient diff algorithm (Myers' algorithm or similar)
    - Lazy loading for large files
    - Virtual scrolling for performance
    - Asynchronous comparison for large files

## Technical Stack
- **Framework**: React with hooks (useState, useEffect, useRef, useCallback, useMemo)
- **Code Editor**: Monaco Editor (VS Code's editor) or CodeMirror
- **Diff Algorithm**: diff-match-patch, jsdiff, or custom implementation
- **Code Formatting**: Prettier
- **Styling**: Tailwind CSS for UI components
- **State Management**: React Context API or lightweight state management
- **File Format**: Single .jsx file for artifact (all-in-one component)

## UI Design

### Layout Structure
1. **Header Section**
   - File path/name display for left, middle (optional), and right panels
   - Toolbar with action buttons (Save, Format, Copy, Merge, etc.)
   - Comparison statistics (e.g., "5 differences found")
   - View options toggles

2. **Control Bar**
   - File/text input areas for pasting or selecting code
   - Format buttons (Prettier) for each panel
   - Comparison method selector (2-way, 3-way)
   - Filter and options dropdowns

3. **Main Comparison Area**
   - Side-by-side diff panels (responsive width)
   - Location pane/minimap on the side
   - Synchronized scrollbars
   - Difference navigation buttons (Previous/Next diff)

4. **Status Bar**
   - Current difference indicator (e.g., "Difference 2 of 5")
   - File encoding information
   - Cursor position (line:column)
   - Comparison status (identical, different)

### Color Coding
- **Green**: Additions (text present in right but not in left)
- **Red**: Deletions (text present in left but not in right)
- **Yellow/Gold**: Modifications (changed lines)
- **Light Yellow**: Word-level differences within lines
- **White/Default**: Identical lines
- **Gray**: Ignored differences (based on filter settings)

### Professional Design Elements
- Clean, minimal interface
- Consistent spacing and alignment
- Clear visual hierarchy
- Accessible color contrasts
- Responsive design for different screen sizes
- Smooth animations and transitions

## Implementation Notes

### Core Functionality
1. **Diff Engine**
   - Implement or integrate efficient line-based diff algorithm
   - Support word-level diff within lines
   - Handle large files efficiently (chunking, streaming)
   - Support binary file comparison (hex view)

2. **Editor Integration**
   - Use Monaco Editor for rich editing experience
   - Configure language support and syntax highlighting
   - Implement synchronized scrolling mechanism
   - Handle line number alignment

3. **Prettier Integration**
   - Import Prettier as dependency
   - Detect language from file extension or content
   - Apply formatting only to valid code
   - Handle formatting errors gracefully
   - Show spinner or loading indicator during formatting

4. **Merge Functionality**
   - Track which panel is source/target for merge
   - Implement copy-to-left, copy-to-right operations
   - Support selective line merging
   - Maintain undo history for merge operations

5. **State Management**
   - Manage file content state for each panel
   - Track differences and their positions
   - Store user preferences (view options, color scheme, etc.)
   - Handle comparison state (in progress, complete, error)

### Performance Considerations
- Use `useMemo` to cache expensive diff calculations
- Implement virtual scrolling for large files
- Debounce/throttle real-time diff updates during editing
- Lazy load syntax highlighting definitions
- Optimize re-renders using `React.memo` and `useCallback`

### Keyboard Shortcuts
- `Ctrl+D` or `F8`: Next difference
- `Shift+F8`: Previous difference
- `Ctrl+Alt+Left/Right`: Copy to left/right
- `Ctrl+F`: Find
- `Ctrl+H`: Replace
- `Ctrl+S`: Save
- `Ctrl+Z`: Undo
- `Ctrl+Y`: Redo
- `Ctrl+G`: Go to line
- `Ctrl+L`: Toggle line numbers
- `F5`: Refresh comparison

### Accessibility
- Keyboard navigation support
- ARIA labels for screen readers
- Focus management for modal dialogs
- High contrast mode support
- Scalable UI (zoom support)

## Future Enhancements (Optional)
- Folder/directory comparison
- Integration with version control systems (Git)
- Plugin system for custom diff algorithms
- Image comparison support
- Excel/spreadsheet comparison
- Archive file comparison (zip, tar)
- Web page comparison
- Command-line interface
- Cloud storage integration
- Real-time collaborative comparison
- AI-powered smart merge suggestions

## Development Guidelines
- Write clean, maintainable, well-commented code
- Follow React best practices and hooks guidelines
- Ensure cross-browser compatibility
- Implement comprehensive error handling
- Add loading states for async operations
- Create reusable components where possible
- Optimize bundle size (code splitting if needed)
- Test with various file sizes and types
- Handle edge cases (empty files, very large files, binary files)

## Success Criteria
- Accurate difference detection and visualization
- Smooth performance even with large files (>10,000 lines)
- Intuitive user interface
- Responsive design works on desktop and tablet
- All core features functional and bug-free
- Code is production-ready and maintainable

---

## Development Changelog

### Version 1.0 - Initial Implementation (January 2026)

#### Core Features Implemented:
1. **Project Setup**
   - Vite + React project with Tailwind CSS
   - Monaco Editor integration (@monaco-editor/react)
   - Prettier integration for code formatting

2. **Diff Algorithm**
   - Custom LCS (Longest Common Subsequence) implementation
   - Line-level diff with merge of adjacent delete/add pairs into "modified"
   - Character-level diff for inline highlighting within modified lines
   - **Bug Fixed**: Corrected merge logic that wasn't properly pairing consecutive deletes with adds

3. **Side-by-Side Editor Layout (WinMerge-style)**
   - Two Monaco Editor panels (Original / Modified)
   - Direct editing in both panels with inline diff highlighting
   - No separate merged result panel - differences shown in-place

4. **Diff Decorations**
   - Line background highlighting (red=deleted, green=added, yellow=modified)
   - Glyph margin markers for quick visual identification
   - Applied via Monaco's `deltaDecorations` API

5. **View Zones (Grey Placeholder Lines)**
   - Grey placeholder lines where code is missing on one side
   - Uses Monaco's `changeViewZones` API
   - Keeps both panels visually aligned like WinMerge
   - Subtle diagonal stripe pattern on placeholders

6. **Synchronized Scrolling**
   - Both editors scroll together
   - Uses `onDidScrollChange` and `setScrollTop` APIs

7. **Navigation**
   - Next/Previous difference buttons
   - Jump to line (Ctrl+G)
   - Minimap showing all diff locations with click-to-jump

8. **Comparison Options**
   - Ignore whitespace toggle
   - Ignore case toggle
   - Ignore blank lines toggle

9. **Merge Operations**
   - Copy all to left/right buttons between panels

10. **File Handling**
    - Drag and drop file upload to either panel
    - Swap panels button
    - Clear all button

11. **Code Formatting**
    - Prettier format button on each panel
    - Supports: JavaScript, TypeScript, HTML, CSS, JSON, GraphQL, YAML, Markdown
    - Loading spinner during formatting

12. **Export Features**
    - Export unified diff patch file
    - Export HTML comparison report
    - Copy diff to clipboard

13. **Language Detection**
    - Auto-detects language from code content
    - Maps to Monaco language IDs and Prettier parsers
    - **Known Issue**: Detection order matters - some patterns overlap (e.g., `import` exists in Python, Java, JS)

14. **Keyboard Shortcuts**
    - F8 / Ctrl+D: Next difference
    - Shift+F8: Previous difference
    - Ctrl+G: Go to line

15. **UI/UX**
    - Dark theme with professional styling
    - Diff statistics in header
    - Footer with shortcut hints
    - Responsive layout

#### Unit Tests:
- 25 tests covering diff algorithm, decorations, and view zones
- Test file: `src/diff.test.js`

#### Known Issues / TODO:
- [ ] Language detection needs improvement (Java `import static` detected as Python)
- [ ] Add manual language selector dropdown
- [ ] 3-way merge not yet implemented
- [ ] Word wrap toggle not yet implemented
- [ ] Find and Replace not yet implemented
- [ ] Binary file comparison not yet implemented

#### Project Structure:
```
/webmerge
├── src/
│   ├── App.jsx          # Main application (all components)
│   ├── main.jsx         # Entry point
│   ├── index.css        # Tailwind + custom styles
│   └── diff.test.js     # Unit tests
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```