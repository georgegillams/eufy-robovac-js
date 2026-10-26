import debug from 'debug';
import TuyAPI from 'tuyapi';
import { EventEmitter } from 'node:events';
import { Buffer } from 'node:buffer';

const COMMAND = {
  playPause: '2',
  workMode: '5',
  activity: '15',
  goHome: '101',
  cleanSpeed: '102',
  findMyRobot: '103',
  battery: '104',
  error: '106',
  cleaningRuntime: '109',
  cleaningCoverage: '110',
  volume: '111',
  consumables: '116',
  multimaps: '117',
  boostIQ: '118',
  // Granular sub-state while activity=Running: Nosweep | Continue | Pause
  workStatus2: '122',
  rooms: '124',
  voice: '125',
  hello: '126',
  autoReturn: '135',
  status: '142',
};

// Alternate DPS IDs used by some newer Eufy models (e.g. certain X8 Pro / X9 schemas).
const COMMAND_ALT = {
  playPause: '151',
  workMode: '152',
  activity: '153',
  cleanSpeed: '158',
  findMyRobot: '160',
  battery: '163',
  goHome: '173',
  error: '177',
};

function dpsHas(dps, id) {
  return dps != null && Object.hasOwn(dps, id);
}

function dpsGet(dps, ...ids) {
  for (const id of ids) {
    if (dpsHas(dps, id)) {
      return { id, value: dps[id] };
    }
  }
  return null;
}

function normalizeActivity(value) {
  if (typeof value !== 'string') {
    return value;
  }
  const lower = value.toLowerCase();
  // Some firmwares report "Completed" instead of "completed".
  if (lower === 'completed') {
    return 'completed';
  }
  // X8 pause / idle-off-dock is lowercase "standby" (also seen as StandingBy).
  if (lower === 'standby' || lower === 'standingby') {
    return 'standby';
  }
  return value;
}

/**
 * Prefer alternate (newer schema) DPS when both classic and alt are present and differ.
 * Stale classic keys are common after schema dumps + partial alt updates.
 */
function dpsGetPreferAlt(dps, classicId, altId) {
  const hasClassic = dpsHas(dps, classicId);
  const hasAlt = altId != null && dpsHas(dps, altId);
  if (hasClassic && hasAlt && dps[classicId] !== dps[altId]) {
    return { id: altId, value: dps[altId] };
  }
  return dpsGet(dps, classicId, altId);
}

const CLEAN_SPEED = {
  quiet: 'Quiet',
  standard: 'Standard',
  turbo: 'Turbo',
  max: 'Max'
};

const ERRORS = {
  0: 'no error',
  1: 'front bumper stuck',
  2: 'wheel stuck',
  3: 'side brush',
  4: 'rolling brush bar stuck',
  5: 'device trapped',
  6: 'device trapped',
  7: 'wheel suspended',
  8: 'low battery',
  9: 'magnetic boundary',
  12: 'right wall sensor',
  13: 'device tilted',
  14: 'insert dust collector',
  17: 'restricted area detected',
  18: 'laser cover stuck',
  19: 'laser sensor stuck',
  20: 'laser sensor blocked',
  21: 'base blocked',
  S1: 'battery',
  S2: 'wheel module',
  S3: 'side brush',
  S4: 'suction fan',
  S5: 'rolling brush',
  S8: 'path tracking sensor',
  Wheel_stuck: 'wheel stuck',
  R_brush_stuck: 'rolling brush stuck',
  Crash_bar_stuck: 'front bumper stuck',
  sensor_dirty: 'sensor dirty',
  N_enough_pow: 'low battery',
  Stuck_5_min: 'device trapped',
  Fan_stuck: 'fan stuck',
  S_brush_stuck: 'side brush stuck',
  no_error: 'no error',
};

class RoboVac extends EventEmitter
{
  dps = {};

  constructor({ ip, deviceId, localKey, version = '3.3' }) {
    super();
    this.ip = ip;
    this.deviceId = deviceId;
    this.localKey = localKey;
    this.version = version;
    this.dps = {};
    this.connected = false;
  }

  async initialize() {
    this.device = new TuyAPI({
      id: this.deviceId,
      key: this.localKey,
      ip: this.ip,
      version: this.version,
      issueRefreshOnConnect: true,
    });

    this.device.on('connected', () => {
      this.connected = true;
      this.emit('tuya.connected');
    });

    this.device.on('disconnected', () => {
      this.connected = false;
      this.emit('tuya.disconnected');
    });

    this.device.on('error', error => {
      this.emit('tuya.error', error);
    });

    this.device.on('data', data => {
      this.dps = { ...this.dps, ...data.dps };
      this.emit('tuya.data', data);
      this.#emitDpsEvents(data.dps);
    });

    this.device.on('dp-refresh', data => {
      this.dps = { ...this.dps, ...data.dps };
      this.emit('tuya.dp-refresh', data);
      this.#emitDpsEvents(data.dps);
    });

    return this.connect();
  }

  #emitDpsEvents(dpsUpdate) {
    if (!dpsUpdate) {
      return;
    }

    Object.keys(dpsUpdate).forEach(command => {
      const value = dpsUpdate[command];
      if (command === COMMAND.playPause || command === COMMAND_ALT.playPause) {
        this.emit('event', { command: 'playPause', value });
      }
      else if (command === COMMAND.workMode || command === COMMAND_ALT.workMode) {
        this.emit('event', { command: 'workMode', value });
      }
      else if (command === COMMAND.activity || command === COMMAND_ALT.activity) {
        this.emit('event', { command: 'activity', value: normalizeActivity(value) });
      }
      else if (command === COMMAND.workStatus2) {
        this.emit('event', { command: 'workStatus2', value });
      }
      else if (command === COMMAND.goHome || command === COMMAND_ALT.goHome) {
        this.emit('event', { command: 'goHome', value });
      }
      else if (command === COMMAND.cleanSpeed || command === COMMAND_ALT.cleanSpeed) {
        this.emit('event', { command: 'cleanSpeed', value });
      }
      else if (command === COMMAND.findMyRobot || command === COMMAND_ALT.findMyRobot) {
        this.emit('event', { command: 'locate', value });
      }
      else if (command === COMMAND.battery || command === COMMAND_ALT.battery) {
        this.emit('event', { command: 'battery', value });
      }
      else if (command === COMMAND.error || command === COMMAND_ALT.error) {
        this.emit('error', this.error());
      }
      else if (command === COMMAND.cleaningRuntime) {
        this.emit('event', { command: 'runtime', value });
      }
      else if (command === COMMAND.cleaningCoverage) {
        this.emit('event', { command: 'coverage', value });
      }
      else if (command === COMMAND.volume) {
        this.emit('event', { command: 'volume', value });
      }
      else if (command === COMMAND.consumables) {
        const consumables = this.consumables();
        this.emit('event', { command: 'consumables', value: consumables });
        if (consumables.consumable?.duration?.SB >= 250) {
          this.emit('alert', { consumable: 'side_brush', duration: consumables.consumable?.duration?.SB });
        }
        if (consumables.consumable?.duration?.RB >= 450) {
          this.emit('alert', { consumable: 'rolling_brush', duration: consumables.consumable?.duration?.RB });
        }
        if (consumables.consumable?.duration?.FM >= 200) {
          this.emit('alert', { consumable: 'filter', duration: consumables.consumable?.duration?.FM });
        }
        if (consumables.consumable?.duration?.SS >= 35) {
          this.emit('alert', { consumable: 'sensors', duration: consumables.consumable?.duration?.SS });
        }
        if (consumables.consumable?.duration?.BatteryStatus !== 1) {
          this.emit('alert', { consumable: 'battery', duration: consumables.consumable?.duration?.BatteryStatus });
        }
      }
      else if (command === COMMAND.multimaps) {
        this.emit('event', { command: 'multimaps', value: this.multimaps() });
      }
      else if (command === COMMAND.boostIQ) {
        this.emit('event', { command: 'boostIQ', value: this.boostIQ() });
      }
      else if (command === COMMAND.rooms) {
        this.emit('event', { command: 'rooms', value: this.rooms() });
      }
      else if (command === COMMAND.voice) {
        this.emit('event', { command: 'voice', value: this.voice() });
      }
      else if (command === COMMAND.hello) {
        this.emit('event', { command: 'hello', value: this.hello() });
      }
      else if (command === COMMAND.autoReturn) {
        this.emit('event', { command: 'autoReturn', value });
      }
      else if (command === COMMAND.status) {
        const status = this.status();
        this.emit('event', { command: 'status', value: status });
        const nestedBattery = this.#batteryFromStatus(status);
        if (nestedBattery !== null) {
          this.emit('event', { command: 'battery', value: nestedBattery });
        }
      }
    });
  }

  #batteryFromStatus(status) {
    if (!status || typeof status !== 'object') {
      return null;
    }
    for (const key of ['bat', 'battery', 'bat_level', 'batteryLevel']) {
      const value = status[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }
    return null;
  }

  /** Resolve classic or alternate DPS id that is present on this device. */
  #commandId(classicId, altId) {
    if (dpsHas(this.dps, classicId)) {
      return classicId;
    }
    if (altId && dpsHas(this.dps, altId)) {
      return altId;
    }
    return null;
  }

  async clean() {
    if (!this.dps) {
      debug('no data points available yet');
      return 'unknown';
    }
    const workModeId = this.#commandId(COMMAND.workMode, COMMAND_ALT.workMode) ?? COMMAND.workMode;
    return this.set({ [workModeId]: 'auto' });
  }

  async cleanRooms(rooms) {
    if (!this.dps) {
      debug('no data points available yet');
      return;
    }
    const fn = {
      method: 'selectRoomsClean',
      data: {
        roomIds: rooms || [ 1 ],
        cleanTimes: 1
      },
      timestamp: Date.now()
    };
    const value = Buffer.from(JSON.stringify(fn)).toString('base64');
    return this.set({ [COMMAND.rooms]: value });
  }

  async resume() {
    if (!this.dps) {
      debug('no data points available yet');
      return 'unknown';
    }
    // Prefer DPS 122 when present — Eufy app resume sets 122="Continue".
    if (this.supportsWorkStatus2Pause()) {
      debug('resume via workStatus2=Continue');
      return this.set({ [COMMAND.workStatus2]: 'Continue' });
    }
    const playPauseId = this.#commandId(COMMAND.playPause, COMMAND_ALT.playPause) ?? COMMAND.playPause;
    return this.set({ [playPauseId]: true });
  }

  /**
   * True mid-job pause when the device exposes DPS 122 (Pause/Continue).
   * Clearing classic playPause (DPS 2/151) ends the clean on those models.
   */
  supportsWorkStatus2Pause() {
    return dpsHas(this.dps, COMMAND.workStatus2);
  }

  workStatus2() {
    if (!this.dps || Object.keys(this.dps).length === 0) {
      debug('no data points available yet');
      return 'unknown';
    }
    if (!dpsHas(this.dps, COMMAND.workStatus2)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.workStatus2];
  }

  async pause() {
    if (!this.dps) {
      debug('no data points available yet');
      return 'unknown';
    }
    // Prefer DPS 122 when present — Eufy app pause sets 122="Pause" and leaves playPause=true.
    if (this.supportsWorkStatus2Pause()) {
      debug('pause via workStatus2=Pause');
      return this.set({ [COMMAND.workStatus2]: 'Pause' });
    }
    const playPauseId = this.#commandId(COMMAND.playPause, COMMAND_ALT.playPause) ?? COMMAND.playPause;
    return this.set({ [playPauseId]: false });
  }

  workMode() {
    if (!this.dps) {
      debug('no data points available yet');
      return 'unknown';
    }
    const workMode = dpsGet(this.dps, COMMAND.workMode, COMMAND_ALT.workMode);
    if (!workMode) {
      throw new Error('RoboVac does not support this command');
    }
    return workMode.value;
  }

  activity() {
    // dps starts as {} before the first TuyAPI refresh; treat that as "not ready"
    // rather than "unsupported" so callers can retry after tuya.data.
    if (!this.dps || Object.keys(this.dps).length === 0) {
      debug('no data points available yet');
      return 'unknown';
    }
    const activity = dpsGetPreferAlt(this.dps, COMMAND.activity, COMMAND_ALT.activity);
    if (!activity) {
      throw new Error('RoboVac does not support this command');
    }
    return normalizeActivity(activity.value);
  }

  batteryLevel() {
    if (!this.dps) {
      debug('no data points available yet');
      return -1;
    }
    const battery = dpsGet(this.dps, COMMAND.battery, COMMAND_ALT.battery);
    if (battery) {
      return battery.value;
    }
    // Some models nest battery inside the base64 status DPS (142) instead of DP 104/163.
    try {
      const nested = this.#batteryFromStatus(this.status());
      if (nested !== null) {
        return nested;
      }
    } catch {
      // status unsupported
    }
    throw new Error('RoboVac does not support this command');
  }

  error() {
    if (!this.dps) {
      debug('no data points available yet');
      return ERRORS[0];
    }
    const error = dpsGet(this.dps, COMMAND.error, COMMAND_ALT.error);
    if (!error) {
      return undefined;
    }
    if (error.value in ERRORS) {
      return ERRORS[error.value];
    }
    return error.value;
  }

  runtime() {
    if (!this.dps) {
      debug('no data points available yet');
      return -1;
    }
    if (!Object.hasOwn(this.dps, COMMAND.cleaningRuntime)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.cleaningRuntime];
  }

  coverage() {
    if (!this.dps) {
      debug('no data points available yet');
      return -1;
    }
    if (!Object.hasOwn(this.dps, COMMAND.cleaningCoverage)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.cleaningCoverage];
  }

  consumables() {
    if (!this.dps) {
      debug('no data points available yet');
      return ''
    }
    if (!Object.hasOwn(this.dps, COMMAND.consumables)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.consumables], 'base64');
    return JSON.parse(json);
  }

  status() {
    if (!this.dps) {
      debug('no data points available yet');
      return ''
    }
    if (!Object.hasOwn(this.dps, COMMAND.status)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.status], 'base64');
    return JSON.parse(json);
  }

  docked() {
    const activity = this.activity();
    return activity === 'Sleeping' || activity === 'Charging' || activity === 'completed';
  }

  async connect() {
    await this.device.find();
    return this.device.connect();
  }

  async disconnect() {
    return this.device.disconnect();
  }

  async get(data) {
    if (!this.connected) {
      throw new Error('RoboVac is disconnected');
    }
    return this.device.get(data);
  }

  async set(data) {
    if (!this.connected) {
      throw new Error('RoboVac is disconnected');
    }
    return this.device.set({ multiple: true, data });
  }

  async refresh() {
    const data = await this.get({ schema: true });
    // TuyAPI usually emits 'data' (which merges dps), but merge the return value
    // defensively so pollers always see a fresh snapshot.
    if (data && typeof data === 'object' && data.dps && typeof data.dps === 'object') {
      this.dps = { ...this.dps, ...data.dps };
    }
    return data;
  }

  async locate(flag) {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    const findId = this.#commandId(COMMAND.findMyRobot, COMMAND_ALT.findMyRobot);
    if (!findId) {
      throw new Error('RoboVac does not support this command');
    }
    if (this.docked()) {
      throw new Error('RoboVac is on the charging base');
    }
    const b = this.dps[findId];
    if (b === flag) {
      return;
    }
    return this.set({ [findId]: flag });
  }

  async goHome(flag) {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (this.docked()) {
      throw new Error('RoboVac is already home');
    }
    const goHomeId = this.#commandId(COMMAND.goHome, COMMAND_ALT.goHome);
    if (!goHomeId) {
      throw new Error('RoboVac does not support this command');
    }
    const b = this.dps[goHomeId];
    if (b === flag) {
      return;
    }
    return this.set({ [goHomeId]: flag });
  }

  goingHome() {
    if (!this.dps || Object.keys(this.dps).length === 0) {
      throw new Error('no data points available yet');
    }
    try {
      if (this.activity() === 'Recharge') {
        return true;
      }
    } catch {
      // activity DPS unsupported — fall through to goHome flag
    }
    const goHome = dpsGet(this.dps, COMMAND.goHome, COMMAND_ALT.goHome);
    if (!goHome) {
      throw new Error('RoboVac does not support this command');
    }
    return goHome.value;
  }

  volume() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!Object.hasOwn(this.dps, COMMAND.volume)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.volume];
  }

  async setVolume(value) {
    if (!Object.hasOwn(this.dps, COMMAND.volume)) {
      throw new Error('RoboVac does not support this command');
    }
    if (value < 0 || value > 100) {
      throw new Error('expecting value between 0 to 100');
    }
    return this.set({ [COMMAND.volume]: value });
  }

  multimaps() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!Object.hasOwn(this.dps, COMMAND.multimaps)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.multimaps], 'base64');
    return JSON.parse(json);
  }

  async setCleanSpeedQuiet() {
    const cleanSpeedId = this.#commandId(COMMAND.cleanSpeed, COMMAND_ALT.cleanSpeed);
    if (!cleanSpeedId) {
      throw new Error('RoboVac does not support this command');
    }
    return this.set({ [cleanSpeedId]: CLEAN_SPEED.quiet });
  }

  async setCleanSpeedStandard() {
    const cleanSpeedId = this.#commandId(COMMAND.cleanSpeed, COMMAND_ALT.cleanSpeed);
    if (!cleanSpeedId) {
      throw new Error('RoboVac does not support this command');
    }
    return this.set({ [cleanSpeedId]: CLEAN_SPEED.standard });
  }

  async setCleanSpeedTurbo() {
    const cleanSpeedId = this.#commandId(COMMAND.cleanSpeed, COMMAND_ALT.cleanSpeed);
    if (!cleanSpeedId) {
      throw new Error('RoboVac does not support this command');
    }
    return this.set({ [cleanSpeedId]: CLEAN_SPEED.turbo });
  }

  async setCleanSpeedMax() {
    const cleanSpeedId = this.#commandId(COMMAND.cleanSpeed, COMMAND_ALT.cleanSpeed);
    if (!cleanSpeedId) {
      throw new Error('RoboVac does not support this command');
    }
    return this.set({ [cleanSpeedId]: CLEAN_SPEED.max });
  }

  boostIQ() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!Object.hasOwn(this.dps, COMMAND.boostIQ)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.boostIQ];
  }

  async setBoostIQ(flag) {
    if (!Object.hasOwn(this.dps, COMMAND.boostIQ)) {
      throw new Error('RoboVac does not support this command');
    }
    const b = this.dps[COMMAND.boostIQ];
    if (b === flag) {
      return;
    }
    return this.set({ [COMMAND.boostIQ]: flag });
  }

  rooms() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!Object.hasOwn(this.dps, COMMAND.rooms)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.rooms], 'base64');
    return JSON.parse(json);
  }

  voice() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!Object.hasOwn(this.dps, COMMAND.voice)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.voice], 'base64');
    return JSON.parse(json);
  }

  hello() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!Object.hasOwn(this.dps, COMMAND.hello)) {
      throw new Error('RoboVac does not support this command');
    }
    const json = Buffer.from(this.dps[COMMAND.hello], 'base64');
    return JSON.parse(json);
  }

  autoReturn() {
    if (!this.dps) {
      throw new Error('no data points available yet');
    }
    if (!Object.hasOwn(this.dps, COMMAND.autoReturn)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.dps[COMMAND.autoReturn];
  }

  async setAutoReturn(flag) {
    if (!Object.hasOwn(this.dps, COMMAND.autoReturn)) {
      throw new Error('RoboVac does not support this command');
    }
    return this.set({ [COMMAND.autoReturn]: flag });
  }
}

export { RoboVac };
