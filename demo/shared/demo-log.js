/** Demo-only log helper (not part of geokit library). */
export function appendLog(logEl, message, data) {
  const time = new Date().toISOString().slice(11, 19);
  const line =
    data === undefined
      ? `[${time}] ${message}`
      : `[${time}] ${message}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`;
  if (logEl) {
    logEl.textContent = `${line}\n\n${logEl.textContent ?? ''}`.trim();
  }
  console.info(line);
}
