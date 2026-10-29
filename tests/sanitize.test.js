const test = require('node:test');
const assert = require('node:assert/strict');
const { DCC, loadHtml } = require('./helpers');

const doc = loadHtml('<!doctype html><body></body>', 'https://example.com/');

test('manual edits keep simple formatting only', () => {
  const html = DCC.sanitizeHtml(
    '<p style="color:red" onclick="x()"><b>bold</b> <font color="red">plain</font></p>' +
    '<script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://ok.example/">good</a>' +
    '<img src="https://img.example/a.jpg" onerror="x()"><img src="dcc-word-1.jpg"><ol start="4"><li value="4">x</li></ol>',
    doc
  );
  assert.equal(html,
    '<p><b>bold</b> plain</p><a>bad</a><a href="https://ok.example/">good</a>' +
    '<img src="https://img.example/a.jpg"><img src="dcc-word-1.jpg"><ol start="4"><li value="4">x</li></ol>');
});
