import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractText, htmlToText, isPdf } from './extract.mjs';
import { buildPdf } from './test-pdf.mjs';

test('reads the text of each page of a PDF separately', async () => {
  const pdf = buildPdf([['Page one heading', 'first line'], ['Second page text']]);
  const { kind, pages } = await extractText(pdf, 'application/pdf');
  assert.equal(kind, 'pdf');
  assert.equal(pages.length, 2);
  assert.match(pages[0], /Page one heading/);
  assert.match(pages[0], /first line/);
  assert.match(pages[1], /Second page text/);
});

test('recognises a PDF by its first bytes even when the server sends the wrong type', async () => {
  const pdf = buildPdf([['hello']]);
  assert.equal(isPdf(pdf, 'application/octet-stream'), true);
  const { kind } = await extractText(pdf, 'application/octet-stream');
  assert.equal(kind, 'pdf');
});

test('turns a web page into plain text without scripts, styles or tags', () => {
  const html = `<html><head><title>T</title><style>p{color:red}</style>
    <script>var secret = "hidden";</script></head>
    <body><h1>Subject&nbsp;content</h1><p>Solve <b>linear</b> equations &amp; more &#8211; done&#x21;</p>
    <!-- a comment --></body></html>`;
  const text = htmlToText(html);
  assert.match(text, /Subject\u00a0content/);
  assert.match(text, /Solve linear equations & more \u2013 done!/);
  assert.doesNotMatch(text, /hidden|color|comment/);
});

test('treats block elements as line breaks so words do not run together', () => {
  assert.equal(
    htmlToText('<p>one</p><p>two</p><br>three<li>four</li>').replace(/\s+/g, ' ').trim(),
    'one two three four',
  );
});

test('an HTML page is one page of text', async () => {
  const bytes = new TextEncoder().encode('<p>Only page</p>');
  const { kind, pages } = await extractText(bytes, 'text/html; charset=utf-8');
  assert.equal(kind, 'html');
  assert.equal(pages.length, 1);
  assert.match(pages[0], /Only page/);
});

test('refuses a file type it cannot read', async () => {
  await assert.rejects(
    extractText(new Uint8Array([1, 2, 3]), 'image/png'),
    /cannot read image\/png/,
  );
});
