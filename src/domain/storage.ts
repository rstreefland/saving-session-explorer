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

/** Attempt both removals even when browser storage becomes unavailable. */
export function forgetAccount() {
  let failed = false;

  for (const name of [KEY, ACCOUNT]) {
    try {
      localStorage.removeItem(name);
    } catch {
      failed = true;
    }
  }

  if (failed)
    throw new Error(
      'The account was disconnected, but saved details could not be removed. Clear this site’s browser data to remove them.',
    );
}
