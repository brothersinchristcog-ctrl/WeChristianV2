import { Linking, Platform } from 'react-native';

export const openInMaps = (lat: number, lng: number, label: string, address?: string) => {
  if (address && address.trim().length > 0) {
    const url = Platform.select({
      ios: `maps://?q=${encodeURIComponent(address)}`,
      android: `geo:0,0?q=${encodeURIComponent(address)}`,
    });
    Linking.openURL(url!);
    return;
  }

  const url = Platform.select({
    ios:     `maps://?q=${label}&ll=${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`,
  });
  Linking.openURL(url!);
};

export const openRoute = (waypoints: { lat: number; lng: number }[]) => {
  if (waypoints.length === 0) return;
  if (waypoints.length === 1) {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${waypoints[0].lat},${waypoints[0].lng}`);
    return;
  }
  
  const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
  const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
  
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  
  if (waypoints.length > 2) {
    const middleWaypoints = waypoints.slice(1, waypoints.length - 1);
    const waypointsStr = middleWaypoints.map(w => `${w.lat},${w.lng}`).join('|');
    url += `&waypoints=${waypointsStr}`;
  }
  
  Linking.openURL(url);
};
