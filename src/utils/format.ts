export interface TimestampInfo {
  iso: string;
  fileSafe: string;
  semverFragment: string;
}

function pad(value: number, length = 2): string {
  return value.toString().padStart(length, "0");
}

export function createTimestamp(date = new Date()): TimestampInfo {
  const iso = date.toISOString();
  const fileSafe = iso.replace(/[:]/g, "-").replace(/\..+/, "");
  const semverFragment = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
  return { iso, fileSafe, semverFragment };
}
