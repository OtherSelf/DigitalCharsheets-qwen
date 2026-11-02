// Глобальные полифилы для node-окружения тестов.
//
// importCharacterFromJSON() в браузере использует FileReader — в Node его нет.
// Простейшая замена на основе File.text() достаточна для тестов импорта.

class NodeFileReaderPolyfill {
  onload: ((event: { target: NodeFileReaderPolyfill }) => void) | null = null;
  onerror: (() => void) | null = null;
  result: string | ArrayBuffer | null = null;

  readAsText(file: File) {
    file
      .text()
      .then((text) => {
        this.result = text;
        this.onload?.({ target: this });
      })
      .catch(() => {
        this.onerror?.();
      });
  }
}

const globals = globalThis as Record<string, unknown>;

if (typeof globals.FileReader === 'undefined') {
  globals.FileReader = NodeFileReaderPolyfill;
}
