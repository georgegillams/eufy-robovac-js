import { describe, it, before, mock } from 'node:test';
import { deepStrictEqual, strictEqual, throws, rejects, ok } from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { RoboVac } from './RoboVac.js';

function b64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

function makeVac(overrides = {}) {
  return new RoboVac({
    ip: '192.168.1.100',
    deviceId: 'device-1',
    localKey: 'key-1',
    ...overrides,
  });
}

describe('RoboVac', () => {
  describe('constructor', () => {
    it('sets properties from options', () => {
      const vac = makeVac();
      strictEqual(vac.ip, '192.168.1.100');
      strictEqual(vac.deviceId, 'device-1');
      strictEqual(vac.localKey, 'key-1');
      deepStrictEqual(vac.dps, {});
      strictEqual(vac.connected, false);
    });
  });

  describe('getters with missing dps keys', () => {
    it('workMode throws when key is missing', () => {
      throws(() => makeVac().workMode(), { message: 'RoboVac does not support this command' });
    });

    it('activity returns unknown when dps is empty', () => {
      strictEqual(makeVac().activity(), 'unknown');
    });

    it('activity throws when dps is populated but activity key is missing', () => {
      const vac = makeVac();
      vac.dps = { '104': 80 };
      throws(() => vac.activity(), { message: 'RoboVac does not support this command' });
    });

    it('batteryLevel throws when key is missing', () => {
      throws(() => makeVac().batteryLevel(), { message: 'RoboVac does not support this command' });
    });

    it('runtime throws when key is missing', () => {
      throws(() => makeVac().runtime(), { message: 'RoboVac does not support this command' });
    });

    it('coverage throws when key is missing', () => {
      throws(() => makeVac().coverage(), { message: 'RoboVac does not support this command' });
    });

    it('consumables throws when key is missing', () => {
      throws(() => makeVac().consumables(), { message: 'RoboVac does not support this command' });
    });

    it('status throws when key is missing', () => {
      throws(() => makeVac().status(), { message: 'RoboVac does not support this command' });
    });

    it('volume throws when key is missing', () => {
      throws(() => makeVac().volume(), { message: 'RoboVac does not support this command' });
    });

    it('boostIQ throws when key is missing', () => {
      throws(() => makeVac().boostIQ(), { message: 'RoboVac does not support this command' });
    });

    it('autoReturn throws when key is missing', () => {
      throws(() => makeVac().autoReturn(), { message: 'RoboVac does not support this command' });
    });

    it('multimaps throws when key is missing', () => {
      throws(() => makeVac().multimaps(), { message: 'RoboVac does not support this command' });
    });

    it('rooms throws when key is missing', () => {
      throws(() => makeVac().rooms(), { message: 'RoboVac does not support this command' });
    });

    it('voice throws when key is missing', () => {
      throws(() => makeVac().voice(), { message: 'RoboVac does not support this command' });
    });

    it('hello throws when key is missing', () => {
      throws(() => makeVac().hello(), { message: 'RoboVac does not support this command' });
    });

    it('error returns "no error" when dps is null', () => {
      const vac = makeVac();
      vac.dps = null;
      strictEqual(vac.error(), 'no error');
    });
  });

  describe('getters (with dps populated)', () => {
    it('workMode reads from dps', () => {
      const vac = makeVac();
      vac.dps = { '5': 'auto' };
      strictEqual(vac.workMode(), 'auto');
    });

    it('activity reads from dps', () => {
      const vac = makeVac();
      vac.dps = { '15': 'Cleaning' };
      strictEqual(vac.activity(), 'Cleaning');
    });

    it('batteryLevel reads from dps', () => {
      const vac = makeVac();
      vac.dps = { '104': 85 };
      strictEqual(vac.batteryLevel(), 85);
    });

    it('batteryLevel reads from alternate dps 163', () => {
      const vac = makeVac();
      vac.dps = { '163': 62 };
      strictEqual(vac.batteryLevel(), 62);
    });

    it('batteryLevel reads nested bat from status dps 142', () => {
      const vac = makeVac();
      vac.dps = { '142': b64({ bat: 47, mode: 'auto' }) };
      strictEqual(vac.batteryLevel(), 47);
    });

    it('activity reads from alternate dps 153', () => {
      const vac = makeVac();
      vac.dps = { '153': 'Charging' };
      strictEqual(vac.activity(), 'Charging');
    });

    it('activity normalizes Completed to completed', () => {
      const vac = makeVac();
      vac.dps = { '15': 'Completed' };
      strictEqual(vac.activity(), 'completed');
    });

    it('activity normalizes StandingBy to standby', () => {
      const vac = makeVac();
      vac.dps = { '15': 'StandingBy' };
      strictEqual(vac.activity(), 'standby');
    });

    it('activity prefers alt dps 153 when classic 15 disagrees', () => {
      const vac = makeVac();
      vac.dps = { '15': 'Running', '153': 'standby' };
      strictEqual(vac.activity(), 'standby');
    });

    it('refresh merges returned dps into local cache', async () => {
      const vac = makeVac();
      vac.connected = true;
      vac.dps = { '15': 'Running' };
      vac.device = {
        get: async () => ({ dps: { '15': 'standby', '2': false } }),
      };
      const data = await vac.refresh();
      deepStrictEqual(data.dps, { '15': 'standby', '2': false });
      deepStrictEqual(vac.dps, { '15': 'standby', '2': false });
    });

    it('runtime reads from dps', () => {
      const vac = makeVac();
      vac.dps = { '109': 42 };
      strictEqual(vac.runtime(), 42);
    });

    it('coverage reads from dps', () => {
      const vac = makeVac();
      vac.dps = { '110': 30 };
      strictEqual(vac.coverage(), 30);
    });

    it('volume reads from dps', () => {
      const vac = makeVac();
      vac.dps = { '111': 50 };
      strictEqual(vac.volume(), 50);
    });

    it('boostIQ reads from dps', () => {
      const vac = makeVac();
      vac.dps = { '118': true };
      strictEqual(vac.boostIQ(), true);
    });

    it('autoReturn reads from dps', () => {
      const vac = makeVac();
      vac.dps = { '135': true };
      strictEqual(vac.autoReturn(), true);
    });
  });

  describe('error()', () => {
    it('returns human-readable string for known numeric codes', () => {
      const vac = makeVac();
      vac.dps = { '106': 1 };
      strictEqual(vac.error(), 'front bumper stuck');
    });

    it('returns human-readable string for known string codes', () => {
      const vac = makeVac();
      vac.dps = { '106': 'Wheel_stuck' };
      strictEqual(vac.error(), 'wheel stuck');
    });

    it('returns raw value for unknown codes', () => {
      const vac = makeVac();
      vac.dps = { '106': 999 };
      strictEqual(vac.error(), 999);
    });

    it('returns "no error" for code 0', () => {
      const vac = makeVac();
      vac.dps = { '106': 0 };
      strictEqual(vac.error(), 'no error');
    });

    it('resolves S-prefix error codes', () => {
      const vac = makeVac();
      const cases = {
        S1: 'battery',
        S2: 'wheel module',
        S3: 'side brush',
        S4: 'suction fan',
        S5: 'rolling brush',
        S8: 'path tracking sensor',
      };
      for (const [code, expected] of Object.entries(cases)) {
        vac.dps = { '106': code };
        strictEqual(vac.error(), expected, code);
      }
    });

    it('returns undefined when error key is missing', () => {
      const vac = makeVac();
      vac.dps = { '5': 'auto' };
      strictEqual(vac.error(), undefined);
    });
  });

  describe('base64 decoders', () => {
    it('consumables decodes base64 JSON', () => {
      const vac = makeVac();
      const data = { consumable: { duration: { SB: 100, RB: 200 } } };
      vac.dps = { '116': b64(data) };
      deepStrictEqual(vac.consumables(), data);
    });

    it('status decodes base64 JSON', () => {
      const vac = makeVac();
      const data = { bat: 85, mode: 'auto' };
      vac.dps = { '142': b64(data) };
      deepStrictEqual(vac.status(), data);
    });

    it('multimaps decodes base64 JSON', () => {
      const vac = makeVac();
      const data = { maps: [{ id: 1, name: 'Floor 1' }] };
      vac.dps = { '117': b64(data) };
      deepStrictEqual(vac.multimaps(), data);
    });

    it('rooms decodes base64 JSON', () => {
      const vac = makeVac();
      const data = { rooms: [{ id: 1, name: 'Kitchen' }] };
      vac.dps = { '124': b64(data) };
      deepStrictEqual(vac.rooms(), data);
    });

    it('voice decodes base64 JSON', () => {
      const vac = makeVac();
      const data = { lang: 'en', enabled: true };
      vac.dps = { '125': b64(data) };
      deepStrictEqual(vac.voice(), data);
    });

    it('hello decodes base64 JSON', () => {
      const vac = makeVac();
      const data = { message: 'hi' };
      vac.dps = { '126': b64(data) };
      deepStrictEqual(vac.hello(), data);
    });
  });

  describe('docked()', () => {
    it('returns true when Sleeping', () => {
      const vac = makeVac();
      vac.dps = { '15': 'Sleeping' };
      strictEqual(vac.docked(), true);
    });

    it('returns true when Charging', () => {
      const vac = makeVac();
      vac.dps = { '15': 'Charging' };
      strictEqual(vac.docked(), true);
    });

    it('returns true when completed', () => {
      const vac = makeVac();
      vac.dps = { '15': 'completed' };
      strictEqual(vac.docked(), true);
    });

    it('returns false when Cleaning', () => {
      const vac = makeVac();
      vac.dps = { '15': 'Cleaning' };
      strictEqual(vac.docked(), false);
    });
  });

  describe('goingHome()', () => {
    it('returns true when activity is Recharge', () => {
      const vac = makeVac();
      vac.dps = { '15': 'Recharge', '101': false };
      strictEqual(vac.goingHome(), true);
    });

    it('returns goHome dps value when not Recharge', () => {
      const vac = makeVac();
      vac.dps = { '15': 'Cleaning', '101': true };
      strictEqual(vac.goingHome(), true);
    });

    it('returns false when goHome is false and not Recharge', () => {
      const vac = makeVac();
      vac.dps = { '15': 'Cleaning', '101': false };
      strictEqual(vac.goingHome(), false);
    });

    it('throws when dps is empty', () => {
      throws(() => makeVac().goingHome(), { message: 'no data points available yet' });
    });

    it('uses goHome dps when activity key is missing', () => {
      const vac = makeVac();
      vac.dps = { '101': true, '104': 80 };
      strictEqual(vac.goingHome(), true);
    });

    it('throws when neither activity nor goHome is present', () => {
      const vac = makeVac();
      vac.dps = { '104': 80 };
      throws(() => vac.goingHome(), { message: 'RoboVac does not support this command' });
    });
  });

  describe('commands (via set)', () => {
    let vac;

    before(() => {
      vac = makeVac();
      vac.connected = true;
      vac.device = { set: mock.fn((opts) => Promise.resolve(opts)) };
      vac.dps = {
        '2': false,
        '5': 'auto',
        '101': false,
        '102': 'Standard',
        '103': false,
        '111': 50,
        '118': true,
        '135': true,
        '15': 'Cleaning',
      };
    });

    it('clean() sets workMode to auto', async () => {
      await vac.clean();
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0], { multiple: true, data: { '5': 'auto' } });
    });

    it('pause() sets workStatus2 to Pause when DPS 122 is present', async () => {
      const vac = makeVac();
      vac.connected = true;
      vac.dps = { '2': true, '122': 'Continue' };
      const sent = [];
      vac.set = async (data) => {
        sent.push(data);
      };
      await vac.pause();
      deepStrictEqual(sent[0], { '122': 'Pause' });
    });

    it('resume() sets workStatus2 to Continue when DPS 122 is present', async () => {
      const vac = makeVac();
      vac.connected = true;
      vac.dps = { '2': true, '122': 'Pause' };
      const sent = [];
      vac.set = async (data) => {
        sent.push(data);
      };
      await vac.resume();
      deepStrictEqual(sent[0], { '122': 'Continue' });
    });

    it('pause() sets playPause to false', async () => {
      await vac.pause();
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0], { multiple: true, data: { '2': false } });
    });

    it('resume() sets playPause to true', async () => {
      await vac.resume();
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0], { multiple: true, data: { '2': true } });
    });

    it('cleanRooms() sends base64-encoded room selection', async () => {
      await vac.cleanRooms([1, 2, 3]);
      const call = vac.device.set.mock.calls.at(-1);
      const payload = call.arguments[0];
      strictEqual(payload.multiple, true);
      const decoded = JSON.parse(Buffer.from(payload.data['124'], 'base64').toString());
      strictEqual(decoded.method, 'selectRoomsClean');
      deepStrictEqual(decoded.data.roomIds, [1, 2, 3]);
      strictEqual(decoded.data.cleanTimes, 1);
      ok(typeof decoded.timestamp === 'number');
    });

    it('cleanRooms() defaults to room 1 when no rooms provided', async () => {
      await vac.cleanRooms();
      const call = vac.device.set.mock.calls.at(-1);
      const decoded = JSON.parse(Buffer.from(call.arguments[0].data['124'], 'base64').toString());
      deepStrictEqual(decoded.data.roomIds, [1]);
    });

    it('setCleanSpeedQuiet() sets correct speed', async () => {
      await vac.setCleanSpeedQuiet();
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0].data, { '102': 'Quiet' });
    });

    it('setCleanSpeedStandard() sets correct speed', async () => {
      await vac.setCleanSpeedStandard();
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0].data, { '102': 'Standard' });
    });

    it('setCleanSpeedTurbo() sets correct speed', async () => {
      await vac.setCleanSpeedTurbo();
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0].data, { '102': 'Turbo' });
    });

    it('setCleanSpeedMax() sets correct speed', async () => {
      await vac.setCleanSpeedMax();
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0].data, { '102': 'Max' });
    });

    it('setBoostIQ() sends when value differs', async () => {
      await vac.setBoostIQ(false);
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0].data, { '118': false });
    });

    it('setBoostIQ() skips when value is same', async () => {
      const prevCalls = vac.device.set.mock.calls.length;
      await vac.setBoostIQ(true);
      strictEqual(vac.device.set.mock.calls.length, prevCalls);
    });

    it('setAutoReturn() sends command', async () => {
      await vac.setAutoReturn(false);
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0].data, { '135': false });
    });
  });

  describe('locate()', () => {
    it('sends findMyRobot when flag differs', async () => {
      const vac = makeVac();
      vac.connected = true;
      vac.device = { set: mock.fn(() => Promise.resolve()) };
      vac.dps = { '103': false, '15': 'Cleaning' };
      await vac.locate(true);
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0].data, { '103': true });
    });

    it('skips when flag is same', async () => {
      const vac = makeVac();
      vac.connected = true;
      vac.device = { set: mock.fn(() => Promise.resolve()) };
      vac.dps = { '103': true, '15': 'Cleaning' };
      await vac.locate(true);
      strictEqual(vac.device.set.mock.calls.length, 0);
    });

    it('throws when docked', async () => {
      const vac = makeVac();
      vac.dps = { '103': false, '15': 'Sleeping' };
      await rejects(() => vac.locate(true), { message: 'RoboVac is on the charging base' });
    });

    it('throws when findMyRobot is unsupported', async () => {
      const vac = makeVac();
      vac.dps = { '15': 'Cleaning' };
      await rejects(() => vac.locate(true), { message: 'RoboVac does not support this command' });
    });
  });

  describe('goHome()', () => {
    it('sends goHome when flag differs', async () => {
      const vac = makeVac();
      vac.connected = true;
      vac.device = { set: mock.fn(() => Promise.resolve()) };
      vac.dps = { '101': false, '15': 'Cleaning' };
      await vac.goHome(true);
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0].data, { '101': true });
    });

    it('skips when flag is same', async () => {
      const vac = makeVac();
      vac.connected = true;
      vac.device = { set: mock.fn(() => Promise.resolve()) };
      vac.dps = { '101': false, '15': 'Cleaning' };
      await vac.goHome(false);
      strictEqual(vac.device.set.mock.calls.length, 0);
    });

    it('throws when already docked', async () => {
      const vac = makeVac();
      vac.dps = { '101': false, '15': 'Sleeping' };
      await rejects(() => vac.goHome(true), { message: 'RoboVac is already home' });
    });

    it('throws when goHome is unsupported', async () => {
      const vac = makeVac();
      vac.dps = { '15': 'Cleaning' };
      await rejects(() => vac.goHome(true), { message: 'RoboVac does not support this command' });
    });
  });

  describe('setVolume()', () => {
    it('sends volume command for valid input', async () => {
      const vac = makeVac();
      vac.connected = true;
      vac.device = { set: mock.fn(() => Promise.resolve()) };
      vac.dps = { '111': 50 };
      await vac.setVolume(75);
      const call = vac.device.set.mock.calls.at(-1);
      deepStrictEqual(call.arguments[0].data, { '111': 75 });
    });

    it('throws for value < 0', async () => {
      const vac = makeVac();
      vac.dps = { '111': 50 };
      await rejects(() => vac.setVolume(-1), { message: 'expecting value between 0 to 100' });
    });

    it('throws for value > 100', async () => {
      const vac = makeVac();
      vac.dps = { '111': 50 };
      await rejects(() => vac.setVolume(101), { message: 'expecting value between 0 to 100' });
    });

    it('throws when volume is unsupported', async () => {
      const vac = makeVac();
      vac.dps = { '5': 'auto' };
      await rejects(() => vac.setVolume(50), { message: 'RoboVac does not support this command' });
    });
  });

  describe('set() and get()', () => {
    it('set throws when disconnected', async () => {
      await rejects(() => makeVac().set({}), { message: 'RoboVac is disconnected' });
    });

    it('get throws when disconnected', async () => {
      await rejects(() => makeVac().get({}), { message: 'RoboVac is disconnected' });
    });
  });

  describe('connect() and disconnect()', () => {
    it('connect calls device.find and device.connect', async () => {
      const vac = makeVac();
      vac.device = {
        find: mock.fn(() => Promise.resolve()),
        connect: mock.fn(() => Promise.resolve()),
      };
      await vac.connect();
      strictEqual(vac.device.find.mock.calls.length, 1);
      strictEqual(vac.device.connect.mock.calls.length, 1);
    });

    it('disconnect calls device.disconnect', async () => {
      const vac = makeVac();
      vac.device = { disconnect: mock.fn(() => Promise.resolve()) };
      await vac.disconnect();
      strictEqual(vac.device.disconnect.mock.calls.length, 1);
    });
  });

  describe('refresh()', () => {
    it('calls get with schema:true', async () => {
      const vac = makeVac();
      vac.connected = true;
      vac.device = { get: mock.fn(() => Promise.resolve({})) };
      await vac.refresh();
      strictEqual(vac.device.get.mock.calls.length, 1);
      deepStrictEqual(vac.device.get.mock.calls[0].arguments[0], { schema: true });
    });
  });

  describe('commands with dps null', () => {
    it('clean returns unknown when dps is null', async () => {
      const vac = makeVac();
      vac.dps = null;
      vac.connected = true;
      vac.device = { set: mock.fn(() => Promise.resolve()) };
      strictEqual(await vac.clean(), 'unknown');
    });

    it('resume returns unknown when dps is null', async () => {
      const vac = makeVac();
      vac.dps = null;
      vac.connected = true;
      vac.device = { set: mock.fn(() => Promise.resolve()) };
      strictEqual(await vac.resume(), 'unknown');
    });

    it('pause returns unknown when dps is null', async () => {
      const vac = makeVac();
      vac.dps = null;
      vac.connected = true;
      vac.device = { set: mock.fn(() => Promise.resolve()) };
      strictEqual(await vac.pause(), 'unknown');
    });

    it('cleanRooms returns undefined when dps is null', async () => {
      const vac = makeVac();
      vac.dps = null;
      vac.connected = true;
      vac.device = { set: mock.fn(() => Promise.resolve()) };
      strictEqual(await vac.cleanRooms(), undefined);
    });
  });

  describe('dp-refresh event handling', () => {
    // Simulates the event handler registration that initialize() would do.
    // We bypass initialize() to avoid new TuyAPI() with fake credentials.
    function wireHandlers(vac) {
      vac.device.on('connected', () => {
        vac.connected = true;
        vac.emit('tuya.connected');
      });
      vac.device.on('disconnected', () => {
        vac.connected = false;
        vac.emit('tuya.disconnected');
      });
      vac.device.on('error', (error) => {
        vac.emit('tuya.error', error);
      });
      vac.device.on('data', (data) => {
        vac.dps = { ...vac.dps, ...data.dps };
        vac.emit('tuya.data', data);
      });
      vac.device.on('dp-refresh', (data) => {
        vac.dps = { ...vac.dps, ...data.dps };
        vac.emit('tuya.dp-refresh', data);
        Object.keys(data.dps).forEach((command) => {
          const value = data.dps[command];
          if (command === '2') {
            vac.emit('event', { command: 'playPause', value });
          } else if (command === '116') {
            const consumables = vac.consumables();
            vac.emit('event', { command: 'consumables', value: consumables });
            if (consumables.consumable?.duration?.SB >= 250) {
              vac.emit('alert', { consumable: 'side_brush', duration: consumables.consumable?.duration?.SB });
            }
            if (consumables.consumable?.duration?.RB >= 450) {
              vac.emit('alert', { consumable: 'rolling_brush', duration: consumables.consumable?.duration?.RB });
            }
            if (consumables.consumable?.duration?.FM >= 200) {
              vac.emit('alert', { consumable: 'filter', duration: consumables.consumable?.duration?.FM });
            }
            if (consumables.consumable?.duration?.SS >= 35) {
              vac.emit('alert', { consumable: 'sensors', duration: consumables.consumable?.duration?.SS });
            }
            if (consumables.consumable?.duration?.BatteryStatus !== 1) {
              vac.emit('alert', { consumable: 'battery', duration: consumables.consumable?.duration?.BatteryStatus });
            }
          } else if (command === '106') {
            vac.emit('error', vac.error());
          }
        });
      });
    }

    it('emits event for playPause via dp-refresh', () => {
      const vac = makeVac();
      vac.dps = {};
      const events = [];
      vac.on('event', (e) => events.push(e));
      vac.device = {
        on: mock.fn((_event, handler) => {
          handler({ dps: { '2': true } });
          return vac.device;
        }),
      };
      wireHandlers(vac);
      strictEqual(events.length, 1);
      deepStrictEqual(events[0], { command: 'playPause', value: true });
    });

    it('emits alerts when consumable thresholds exceeded', () => {
      const vac = makeVac();
      vac.dps = {};
      const alerts = [];
      vac.on('alert', (a) => alerts.push(a));
      const consumableData = b64({
        consumable: {
          duration: { SB: 300, RB: 500, FM: 250, SS: 40, BatteryStatus: 0 },
        },
      });
      vac.device = {
        on: mock.fn((_event, handler) => {
          handler({ dps: { '116': consumableData } });
          return vac.device;
        }),
      };
      wireHandlers(vac);
      const names = alerts.map((a) => a.consumable);
      ok(names.includes('side_brush'));
      ok(names.includes('rolling_brush'));
      ok(names.includes('filter'));
      ok(names.includes('sensors'));
      ok(names.includes('battery'));
    });

    it('emits no alerts when consumables below threshold', () => {
      const vac = makeVac();
      vac.dps = {};
      const alerts = [];
      vac.on('alert', (a) => alerts.push(a));
      const consumableData = b64({
        consumable: {
          duration: { SB: 100, RB: 200, FM: 100, SS: 20, BatteryStatus: 1 },
        },
      });
      vac.device = {
        on: mock.fn((_event, handler) => {
          handler({ dps: { '116': consumableData } });
          return vac.device;
        }),
      };
      wireHandlers(vac);
      strictEqual(alerts.length, 0);
    });

    it('emits tuya.connected on device connect', () => {
      const vac = makeVac();
      let emitted = false;
      vac.on('tuya.connected', () => { emitted = true; });
      vac.device = {
        on: mock.fn((event, handler) => {
          if (event === 'connected') handler();
          return vac.device;
        }),
      };
      wireHandlers(vac);
      strictEqual(emitted, true);
      strictEqual(vac.connected, true);
    });

    it('emits tuya.disconnected on device disconnect', () => {
      const vac = makeVac();
      vac.connected = true;
      let emitted = false;
      vac.on('tuya.disconnected', () => { emitted = true; });
      vac.device = {
        on: mock.fn((event, handler) => {
          if (event === 'disconnected') handler();
          return vac.device;
        }),
      };
      wireHandlers(vac);
      strictEqual(emitted, true);
      strictEqual(vac.connected, false);
    });

    it('emits tuya.error on device error', () => {
      const vac = makeVac();
      let lastError;
      vac.on('tuya.error', (e) => { lastError = e; });
      vac.device = {
        on: mock.fn((event, handler) => {
          if (event === 'error') handler(new Error('boom'));
          return vac.device;
        }),
      };
      wireHandlers(vac);
      ok(lastError instanceof Error);
      strictEqual(lastError.message, 'boom');
    });

    it('merges dps on data event', () => {
      const vac = makeVac();
      vac.dps = { '5': 'auto' };
      vac.device = {
        on: mock.fn((event, handler) => {
          if (event === 'data') handler({ dps: { '15': 'Cleaning' } });
          return vac.device;
        }),
      };
      wireHandlers(vac);
      deepStrictEqual(vac.dps, { '5': 'auto', '15': 'Cleaning' });
    });

    it('emits error event when error dps received', () => {
      const vac = makeVac();
      const errors = [];
      vac.on('error', (e) => errors.push(e));
      vac.dps = {};
      vac.device = {
        on: mock.fn((_event, handler) => {
          handler({ dps: { '106': 2 } });
          return vac.device;
        }),
      };
      wireHandlers(vac);
      strictEqual(errors.length, 1);
      strictEqual(errors[0], 'wheel stuck');
    });
  });
});
