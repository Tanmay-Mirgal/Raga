import { useSyncExternalStore } from 'react';
import * as Network from 'expo-network';

export interface NetState {
  /** Device has a usable internet connection. */
  online: boolean;
  /** Connection is Wi-Fi / ethernet (i.e. not metered cellular). */
  unmetered: boolean;
}

let state: NetState = { online: true, unmetered: true };
const listeners = new Set<() => void>();
let started = false;

function apply(s: Network.NetworkState) {
  const online = s.isConnected !== false && s.isInternetReachable !== false;
  const unmetered =
    s.type === Network.NetworkStateType.WIFI || s.type === Network.NetworkStateType.ETHERNET;
  if (online === state.online && unmetered === state.unmetered) return;
  state = { online, unmetered };
  listeners.forEach((l) => l());
}

/** Start watching connectivity. Safe to call many times. */
export function startNetworkMonitor() {
  if (started) return;
  started = true;
  Network.getNetworkStateAsync().then(apply).catch(() => {});
  try {
    Network.addNetworkStateListener(apply);
  } catch {
    // listener unsupported on this platform; the initial snapshot is all we get
  }
}

export const getNetState = () => state;
export const isOnline = () => state.online;

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useNetwork(): NetState {
  return useSyncExternalStore(subscribe, getNetState, getNetState);
}

export class OfflineError extends Error {
  constructor() {
    super('Device is offline');
    this.name = 'OfflineError';
  }
}
