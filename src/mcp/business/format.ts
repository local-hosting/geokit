const METERS_PER_MILE = 1609.344;

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}

export function metersToMiles(meters: number): string {
  const miles = meters / METERS_PER_MILE;
  if (miles < 0.1) {
    return `${Math.round(meters)} m`;
  }
  return `${miles.toFixed(1)} mi`;
}

export function formatStraightLineDistance(meters: number): string {
  const miles = meters / METERS_PER_MILE;
  const km = meters / 1000;
  if (miles < 0.1) {
    return `About ${Math.round(meters)} meters apart.`;
  }
  return `About ${miles.toFixed(1)} miles (${km.toFixed(1)} km) apart as the crow flies.`;
}

export function formatDriveTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) {
    return 'under a minute';
  }
  if (minutes < 60) {
    return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) {
    return `about ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `about ${hours}h ${rem}m`;
}

export function formatAreaSqMiles(sqMiles: number): string {
  if (sqMiles < 1) {
    return `${sqMiles.toFixed(2)} square miles`;
  }
  return `${sqMiles.toFixed(1)} square miles`;
}

export function markdownTable(headers: string[], rows: string[][]): string {
  const header = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return [header, divider, body].join('\n');
}

export function formatInteractiveMapLink(hostUrl: string): string {
  const link = `[Open interactive map](${hostUrl})`;
  if (!/localhost|127\.0\.0\.1/i.test(hostUrl)) {
    return link;
  }
  return `${link}\n\nRun \`yarn map-host\` in packages/geokit if the link does not open.`;
}
