const KEY = 'session-lens.api-key';
const ACCOUNT = 'session-lens.account-number';
function read(name: string) {
  try {
    return localStorage.getItem(name) ?? '';
  } catch {
    return '';
  }
}
function save(name: string, value: string) {
  try {
    if (value) localStorage.setItem(name, value);
    else localStorage.removeItem(name);
  } catch {
    throw new Error(
      'Browser storage is unavailable. Allow local storage to save your account details.',
    );
  }
}
export const readKey = () => read(KEY);
export const readAccount = () => read(ACCOUNT);
export const saveKey = (value: string) => save(KEY, value);
export const saveAccount = (value: string) => save(ACCOUNT, value);
