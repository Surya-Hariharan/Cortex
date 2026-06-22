export function saveTokens(access, refresh) {
  return window.electronAPI?.tokenSave(access, refresh);
}

export function getAccessToken() {
  return window.electronAPI?.tokenGetAccess() ?? Promise.resolve(null);
}

export function getRefreshToken() {
  return window.electronAPI?.tokenGetRefresh() ?? Promise.resolve(null);
}

export function clearTokens() {
  return window.electronAPI?.tokenClear();
}
