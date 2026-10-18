import { buildP5SandboxDocument } from './p5-preview-document';
import { DEFAULT_P5_SKETCH_SOURCE } from './p5-source';

// Characterizes the generated sandbox script: p5 mounts by element id after load and readiness waits for a canvas.
it('resolves the mount after document load and reports ready only after a canvas is attached', () => {
  const sandboxDocument = buildP5SandboxDocument(DEFAULT_P5_SKETCH_SOURCE, 'mount-contract', '/p5.js');

  expect(sandboxDocument).toMatch(/new runnerWindow\.p5\(sketch, ["']sketch["']\)/u);
  expect(sandboxDocument).not.toMatch(
    /new runnerWindow\.p5\(sketch, runnerDocument\.getElementById\(["']sketch["']\)\)/u,
  );
  expect(sandboxDocument).toMatch(/runnerDocument\.querySelector\(["']#sketch canvas["']\)/u);
  expect(sandboxDocument).toContain('#sketch{display:grid;place-items:center}');
  expect(sandboxDocument).toContain('width:auto!important;height:auto!important');
  const drawIndex = sandboxDocument.indexOf('await program.draw?.(...args);');
  const readyIndex = sandboxDocument.indexOf('signalReady();', drawIndex);
  expect(drawIndex).toBeGreaterThan(-1);
  expect(readyIndex).toBeGreaterThan(drawIndex);
});

it('creates an opaque-frame document that denies network, same-origin and nested execution', () => {
  const sandboxDocument = buildP5SandboxDocument('</script><script>parent.pwned=true</script>', 'contract', '/p5.js');
  expect(sandboxDocument).toContain("connect-src 'none'");
  expect(sandboxDocument).toContain("worker-src 'none'");
  expect(sandboxDocument).not.toContain('</script><script>parent.pwned=true</script>');
});
