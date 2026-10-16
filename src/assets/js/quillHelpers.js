
// ==========================================================
// QUILL RICH TEXT EDITOR
// ==========================================================
const QuillInput = ({ item, onChange }) => {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const itemRef = useRef(item);
  const lastHtmlRef = useRef("");

  // ----------------------------------------------------------
  // Keep latest props without recreating Quill
  // ----------------------------------------------------------
  useEffect(() => {
    onChangeRef.current = onChange;
    itemRef.current = item;
  }, [onChange, item]);

  // ==========================================================
  // INITIALIZE QUILL
  // ==========================================================
  useEffect(() => {
    if (!editorRef.current || quillRef.current) {
      return;
    }

    let cancelled = false;
    let quillInstance = null;

    const initializeQuill = async () => {
      try {
        const { default: Quill } = await import("quill");

        if (
          cancelled ||
          !editorRef.current ||
          quillRef.current
        ) {
          return;
        }

        // ----------------------------------------------------
        // Create editor
        // ----------------------------------------------------
        quillInstance = new Quill(editorRef.current, {
          theme: "snow",

          placeholder: `Enter ${formatFieldName(
            itemRef.current.ss_field,
          ).toLowerCase()}...`,

          modules: {
            toolbar: {
              container: [
                // Text formatting
                ["bold", "italic", "underline", "strike"],

                // Text color
                [
                  {
                    color: [],
                  },
                  {
                    background: [],
                  },
                ],

                // Headers
                [
                  {
                    header: [1, 2, 3, 4, 5, 6, false],
                  },
                ],

                // Font size
                [
                  {
                    size: [
                      "small",
                      false,
                      "large",
                      "huge",
                    ],
                  },
                ],

                // Lists
                [
                  {
                    list: "ordered",
                  },
                  {
                    list: "bullet",
                  },
                ],

                // Indent
                [
                  {
                    indent: "-1",
                  },
                  {
                    indent: "+1",
                  },
                ],

                // Alignment
                [
                  {
                    align: [],
                  },
                ],

                // Blocks
                [
                  "blockquote",
                  "code-block",
                ],

                // Links
                ["link"],

                // Remove formatting
                ["clean"],
              ],
            },

            // ------------------------------------------------
            // Better undo / redo behavior
            // ------------------------------------------------
            history: {
              delay: 1000,
              maxStack: 100,
              userOnly: true,
            },

            // ------------------------------------------------
            // Better clipboard behavior
            // ------------------------------------------------
            clipboard: {
              matchVisual: false,
            },
          },
        });

        // ----------------------------------------------------
        // Store instance
        // ----------------------------------------------------
        quillRef.current = quillInstance;

        // ----------------------------------------------------
        // Load initial value
        // ----------------------------------------------------
        const initialValue = getInputValue(
          itemRef.current.ss_value,
        );

        if (initialValue) {
          quillInstance.clipboard.dangerouslyPasteHTML(
            initialValue,
            "silent",
          );
        }

        // ----------------------------------------------------
        // Store initial HTML
        // ----------------------------------------------------
        const initialHtml = normalizeQuillHtml(
          quillInstance.root.innerHTML,
        );

        lastHtmlRef.current = initialHtml;

        // ----------------------------------------------------
        // Text change
        // ----------------------------------------------------
        const handleTextChange = (
          delta,
          oldDelta,
          source,
        ) => {
          // Ignore programmatic changes
          if (source !== "user") {
            return;
          }

          const html = normalizeQuillHtml(
            quillInstance.root.innerHTML,
          );

          // Avoid duplicate updates
          if (html === lastHtmlRef.current) {
            return;
          }

          lastHtmlRef.current = html;

          onChangeRef.current?.(
            itemRef.current.ss_id,
            html,
          );
        };

        quillInstance.on(
          "text-change",
          handleTextChange,
        );

        // ----------------------------------------------------
        // Improve toolbar accessibility
        // ----------------------------------------------------
        setupQuillToolbarLabels(editorRef.current);

        // ----------------------------------------------------
        // Focus handling
        // ----------------------------------------------------
        const handleFocus = () => {
          editorRef.current?.classList.add(
            "is-focused",
          );
        };

        const handleBlur = () => {
          editorRef.current?.classList.remove(
            "is-focused",
          );
        };

        quillInstance.root.addEventListener(
          "focus",
          handleFocus,
        );

        quillInstance.root.addEventListener(
          "blur",
          handleBlur,
        );
      } catch (error) {
        console.error(
          "Failed to initialize Quill:",
          error,
        );
      }
    };

    initializeQuill();

    // ========================================================
    // CLEANUP
    // ========================================================
    return () => {
      cancelled = true;

      if (quillInstance) {
        quillInstance.off("text-change");
        quillInstance.disable();

        quillInstance = null;
      }

      quillRef.current = null;
    };
  }, []);

  // ==========================================================
  // UPDATE CONTENT WHEN VALUE CHANGES EXTERNALLY
  // ==========================================================
  useEffect(() => {
    const quill = quillRef.current;

    if (!quill) {
      return;
    }

    const externalValue = normalizeQuillHtml(
      getInputValue(item.ss_value),
    );

    const currentHtml = normalizeQuillHtml(
      quill.root.innerHTML,
    );

    // Nothing changed
    if (
      externalValue === currentHtml ||
      externalValue === lastHtmlRef.current
    ) {
      return;
    }

    // --------------------------------------------------------
    // Preserve cursor
    // --------------------------------------------------------
    const selection = quill.getSelection();

    // --------------------------------------------------------
    // Replace content silently
    // --------------------------------------------------------
    quill.clipboard.dangerouslyPasteHTML(
      externalValue || "",
      "silent",
    );

    // --------------------------------------------------------
    // Update stored value
    // --------------------------------------------------------
    lastHtmlRef.current = normalizeQuillHtml(
      quill.root.innerHTML,
    );

    // --------------------------------------------------------
    // Restore cursor
    // --------------------------------------------------------
    if (selection) {
      const maxIndex = Math.max(
        0,
        quill.getLength() - 1,
      );

      quill.setSelection(
        Math.min(selection.index, maxIndex),
        selection.length,
        "silent",
      );
    }
  }, [item.ss_value]);

  return (
    <div className="quill-wrapper overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
      <div
        ref={editorRef}
        className="quill-editor min-h-[260px] text-sm text-slate-700"
      />
    </div>
  );
};

// ==========================================================
// NORMALIZE QUILL HTML
// ==========================================================
function normalizeQuillHtml(value) {
  if (!value) {
    return "";
  }

  const html = String(value).trim();

  // Quill uses <p><br></p> for an empty editor
  if (
    html === "<p><br></p>" ||
    html === "<div><br></div>" ||
    html === "<p></p>"
  ) {
    return "";
  }

  return html;
}

// ==========================================================
// QUILL TOOLBAR ACCESSIBILITY
// ==========================================================
function setupQuillToolbarLabels(container) {
  if (!container) {
    return;
  }

  const labels = {
    ".ql-bold": "Bold",
    ".ql-italic": "Italic",
    ".ql-underline": "Underline",
    ".ql-strike": "Strikethrough",

    ".ql-color": "Text color",
    ".ql-background": "Highlight color",

    ".ql-header": "Heading",
    ".ql-size": "Text size",

    ".ql-list[value='ordered']":
      "Numbered list",

    ".ql-list[value='bullet']":
      "Bullet list",

    ".ql-indent[value='-1']":
      "Decrease indent",

    ".ql-indent[value='+1']":
      "Increase indent",

    ".ql-align": "Text alignment",

    ".ql-blockquote": "Block quote",
    ".ql-code-block": "Code block",

    ".ql-link": "Insert link",

    ".ql-clean": "Remove formatting",
  };

  Object.entries(labels).forEach(
    ([selector, label]) => {
      const element =
        container.querySelector(selector);

      if (!element) {
        return;
      }

      element.setAttribute(
        "aria-label",
        label,
      );

      element.setAttribute(
        "title",
        label,
      );
    },
  );
}