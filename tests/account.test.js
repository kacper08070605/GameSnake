import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeUsername,
  validateUsername,
  validatePassword,
  usernameToEmail,
  describeAuthError,
} from '../src/account.js';

test('normalizeUsername usuwa spacje i zmienia na małe litery', () => {
  assert.equal(normalizeUsername('  Kacper_1 '), 'kacper_1');
  assert.equal(normalizeUsername(null), '');
});

test('validateUsername przepuszcza poprawne loginy', () => {
  for (const name of ['abc', 'kacper_1', 'a'.repeat(16), '___']) {
    assert.equal(validateUsername(name), null, name);
  }
});

test('validateUsername odrzuca niepoprawne loginy', () => {
  for (const name of ['', 'ab', 'a'.repeat(17), 'Kacper', 'ola nowak', 'żółw', 'a-b', 'a@b']) {
    assert.equal(typeof validateUsername(name), 'string', name);
  }
});

test('validatePassword wymaga co najmniej 6 znaków', () => {
  assert.equal(validatePassword('123456'), null);
  assert.equal(typeof validatePassword('12345'), 'string');
  assert.equal(typeof validatePassword(undefined), 'string');
});

test('usernameToEmail buduje techniczny adres', () => {
  assert.equal(usernameToEmail('kacper_1'), 'kacper_1@gracze.waz-bez-granic.app');
});

test('describeAuthError tłumaczy błędy Supabase na polski', () => {
  assert.equal(describeAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }), 'Zły login lub hasło.');
  assert.equal(describeAuthError({ code: 'email_exists' }), 'Ten login jest już zajęty.');
  assert.equal(describeAuthError({ code: '23505' }), 'Ten login jest już zajęty.');
  assert.equal(describeAuthError({ status: 429 }), 'Za dużo prób — spróbuj za chwilę.');
  assert.equal(describeAuthError({ name: 'AuthRetryableFetchError' }), 'Brak połączenia z bazą.');
  assert.equal(describeAuthError(null), 'Coś poszło nie tak — spróbuj ponownie.');
});
