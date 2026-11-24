# Content sourcing misadventures

Tags: #content #citations #verification

- **Plain text extracted from exam board PDFs is not the document's text where maths is
  typeset.** `pdftotext` (with or without `-layout`) puts superscripts, fraction parts and
  formula pieces in among the words (for example 1MA1 R13 comes out as "describe direct Y and
  inverse proportion"). A quote check that only searches extracted text rejects correct quotes,
  and one that "cleans up" the text can accept wrong ones. Check quotes near maths against a
  rendered image of the page (`pdftoppm -f <page> -l <page> -png`), and prefer quotes made of
  plain words. Six pilot quotes needed this (A12, A23, A24, R13, G20, G23).
- **The 1MA1 specification PDF says "Issue 2 – June 2015" on every page but the file was last
  modified in August 2023.** Cite the issue printed on the document, and rely on the SHA-256 to
  pin the exact file that was read.
- **The first pilot citations claimed the specification "supports" answers, hints, mark schemes
  and wrong options.** A specification only says what is in scope; it never shows that an answer
  is right. Over-claiming `supports` hides what still needs a real check. Name only what the
  quote backs; maths answers are backed by the maths engine.
- **Pearson's qualification page does not link the sample assessment materials in its HTML**
  (they load dynamically), so a script that scrapes the page for PDFs finds only the
  specification and teaching guides. Do not guess document URLs; get them from a browser or the
  board's search.
