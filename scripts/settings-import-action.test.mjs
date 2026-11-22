import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url), React = require('react'), ts = require('typescript');
const source = await readFile(new URL('../src/components/settings/SettingsPage.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const statement = { success: true, sourceApp: 'Test', fileName: 'test.csv', transactions: [{ title: 'Example', date: '2026-05-12', type: 'expense', amount: -25, upiAccountId: 'retired' }] };

function harness(accounts = [], selectedAccountId = '') {
  const slots = [], calls = [], actions = [], timers = [];
  let cursor = 0, tree, rejectSave = false;
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, update => { slots[index].value = typeof update === 'function' ? update(slots[index].value) : update; }];
    },
    useRef: initial => slots[cursor++] ??= { current: initial },
    useCallback: callback => callback,
    useLayoutEffect() {},
  };
  const asyncAction = () => {
    const busy = hooks.useRef(false);
    const [pending, setPending] = hooks.useState(false), [error, setError] = hooks.useState('');
    return { pending, error, setError, run: action => {
      if (busy.current) return;
      busy.current = true; setPending(true); setError('');
      const result = (async () => {
        try { await action(); } catch (failure) { setError(failure.message); }
        finally { busy.current = false; setPending(false); }
      })();
      actions.push(result);
      return result;
    } };
  };
  const store = { accounts, selectedAccountId, trips: [], friends: [], importTransactions: async rows => {
    calls.push(rows);
    if (rejectSave) throw new Error('Device storage unavailable');
    return rows.length;
  } };
  const mockRequire = name => {
    if (name === 'react') return hooks;
    if (name === 'react-native') return { Platform: { OS: 'ios' }, StyleSheet: { create: value => value }, ...Object.fromEntries(['View', 'Text', 'ScrollView', 'TouchableOpacity', 'TextInput', 'Image', 'ActivityIndicator'].map(key => [key, key])) };
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) };
    if (name.includes('AuthContext')) return { useAuth: () => ({ profile: {}, user: {} }) };
    if (name.includes('useAsyncAction')) return { useAsyncAction: asyncAction, FormError: 'FormError' };
    if (name.includes('LiquidGlassContext')) return { useLiquidGlass: () => ({ themeMode: 'dark', currency: 'INR', formatAmount: String }) };
    if (name.includes('SplitTrackStore')) return { useSplitTrack: () => store };
    if (name.includes('TransactionActions')) return { useTransactionActions: () => ({}) };
    if (name.includes('SettingsAvatarTransition')) return { useSettingsAvatarTransition: () => null };
    if (name.includes('importTransactions')) return { parseAnyTextTransactions: () => statement };
    if (name === '../../theme/colors') return { currencies: { INR: { symbol: '₹' } } };
    if (name.includes('actionColors')) return { ACTION_COLORS: { success: '#16734B', danger: '#A92F3A', onAction: '#FFFFFF' } };
    if (name.includes('haptics')) return { triggerNotification() {}, triggerImpact() {}, NotificationType: { Success: 'success' } };
    if (name.includes('SmoothCollapsible')) return { SmoothCollapsible: 'SmoothCollapsible', triggerSmoothLayout() {} };
    return new Proxy({}, { get: (_, key) => String(key) });
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: mockRequire,
    setTimeout: callback => { timers.push(callback); }, requestAnimationFrame() {}, cancelAnimationFrame() {},
  });
  const render = () => { cursor = 0; tree = module.exports.SettingsPage({ onBack() {} }); };
  const find = predicate => {
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { for (const item of value) { const found = visit(item); if (found) return found; } return; }
      if (value.props && predicate(value)) return value;
      return visit(value.props?.children);
    };
    return visit(tree);
  };
  render();
  find(node => node.type === 'TextInput').props.onChangeText('synthetic'); render();
  find(node => node.type === 'AnimatedPressable' && node.props.children?.props?.children === 'Parse Statement / Data').props.onPress(); render();
  return { render, find, calls, store, reject() { rejectSave = true; },
    confirm: () => find(node => node.props.accessibilityLabel?.startsWith('Confirm and import')),
    async finish() { timers.splice(0).forEach(callback => callback()); await Promise.all(actions); render(); },
  };
}

test('a missing payment profile opens its editor and retains the import preview', () => {
  const h = harness();
  assert.equal(h.confirm().props.disabled, false);
  h.confirm().props.onPress(); h.render();
  assert.equal(h.find(node => node.type === 'AddUpiProfileModal').props.visible, true);
  assert.ok(h.confirm());
  assert.match(h.find(node => node.type === 'FormError' && node.props.message).props.message, /Add a UPI\/card profile/);
  assert.equal(h.calls.length, 0);
});

test('a stale selection uses an active profile, shows pending, and saves once', async () => {
  const h = harness([{ id: 'active', title: 'Bank' }], 'retired');
  h.confirm().props.onPress(); h.confirm().props.onPress(); h.render();
  assert.equal(h.confirm().props.disabled, true);
  assert.equal(h.confirm().props.accessibilityState.busy, true);
  assert.equal(h.calls.length, 0, 'saving feedback precedes batch work');
  await h.finish();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0].upiAccountId, 'active');
  assert.equal(h.confirm(), undefined);
});

test('adding a profile returns to the retained preview and imports into that profile', async () => {
  const h = harness();
  h.confirm().props.onPress(); h.render();
  h.store.accounts.push({ id: 'new-profile', title: 'New bank' });
  h.store.selectedAccountId = 'new-profile';
  h.find(node => node.type === 'AddUpiProfileModal').props.onClose(); h.render();
  assert.equal(h.find(node => node.type === 'AddUpiProfileModal').props.visible, false);
  assert.ok(h.confirm());
  h.confirm().props.onPress(); await h.finish();
  assert.equal(h.calls[0][0].upiAccountId, 'new-profile');
});

test('a failed device save leaves the preview available and an inline retry error', async () => {
  const h = harness([{ id: 'active', title: 'Bank' }], 'active'); h.reject();
  h.confirm().props.onPress(); await h.finish();
  assert.ok(h.confirm());
  assert.equal(h.confirm().props.disabled, false);
  assert.equal(h.find(node => node.type === 'FormError' && node.props.message).props.message, 'Device storage unavailable');
});
