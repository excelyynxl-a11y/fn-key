// translator between the uploaded file and your AI service

export function parseTextFile(file) {
  return file.buffer.toString('utf-8');
}